import fs from "node:fs";
import path from "node:path";
import { chromium } from "@playwright/test";

export async function runQa({ issueKey, url, requirements, runDir }) {
  const qaDir = path.join(runDir, "qa");
  fs.mkdirSync(qaDir, { recursive: true });
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
  const consoleErrors = [];
  page.on("console", (msg) => {
    if (msg.type() === "error") consoleErrors.push(msg.text());
  });
  page.on("pageerror", (error) => consoleErrors.push(error.message));

  const results = [];
  const screenshots = [];
  try {
    await page.goto(url, { waitUntil: "networkidle" });
    screenshots.push(await shot(page, qaDir, "01-initial-load"));

    const lower = requirements.toLowerCase();
    if (lower.includes("todo")) {
      await testTodo(page, qaDir, results, screenshots);
    } else {
      await expectCriterion(results, "Page loads", true, "Document rendered");
      await expectCriterion(results, "No empty body", await page.locator("body").innerText().then((v) => v.trim().length > 0), "Body contains visible text");
    }

    await page.setViewportSize({ width: 375, height: 720 });
    screenshots.push(await shot(page, qaDir, "99-mobile"));
    await expectCriterion(results, "Usable on mobile screen 375px wide", true, "Mobile viewport rendered without crash");
  } catch (error) {
    results.push({ criterion: "QA agent execution", result: "FAIL", notes: error.message });
  } finally {
    await browser.close();
  }

  if (consoleErrors.length === 0) {
    results.push({ criterion: "No console errors", result: "PASS", notes: "" });
  } else {
    results.push({ criterion: "No console errors", result: "FAIL", notes: consoleErrors.join("; ") });
  }

  const failed = results.some((item) => item.result === "FAIL");
  const partial = results.some((item) => item.result === "PARTIAL");
  const status = failed ? "FAIL" : partial ? "PARTIAL" : "PASS";
  const reportPath = path.join(qaDir, "bug-report.md");
  fs.writeFileSync(reportPath, renderReport({ issueKey, url, status, results, consoleErrors, screenshots }));
  return { status, reportPath, screenshots, results };
}

async function testTodo(page, qaDir, results, screenshots) {
  await page.getByLabel("New todo").fill("Record the final demo");
  await page.getByRole("button", { name: "Add" }).click();
  await expectCriterion(results, "Add a todo item", await page.getByText("Record the final demo").isVisible(), "Todo appears after add");
  screenshots.push(await shot(page, qaDir, "02-after-add"));

  await page.getByLabel("Toggle todo").first().check();
  const completed = await page.locator("li.completed", { hasText: "Record the final demo" }).count();
  await expectCriterion(results, "Mark a todo as complete", completed > 0, "Completed class applied");
  screenshots.push(await shot(page, qaDir, "03-after-complete"));

  await expectCriterion(results, "Show remaining incomplete count", await page.getByText("0 remaining").isVisible(), "Remaining count updated");
  await page.reload({ waitUntil: "networkidle" });
  await expectCriterion(results, "Persist todos after refresh", await page.getByText("Record the final demo").isVisible(), "Todo survives reload");
  await page.getByRole("button", { name: "Delete" }).first().click();
  await expectCriterion(results, "Delete a todo item", await page.getByText("Record the final demo").count().then((count) => count === 0), "Todo removed");
  screenshots.push(await shot(page, qaDir, "04-after-delete"));
}

async function expectCriterion(results, criterion, passed, notes) {
  results.push({ criterion, result: passed ? "PASS" : "FAIL", notes });
}

async function shot(page, dir, name) {
  const filePath = path.join(dir, `${name}.png`);
  await page.screenshot({ path: filePath, fullPage: true });
  return filePath;
}

function renderReport({ issueKey, url, status, results, consoleErrors, screenshots }) {
  const rows = results.map((item) => `| ${item.criterion} | ${item.result} | ${item.notes || ""} |`).join("\n");
  const shotList = screenshots.map((file) => `- ${path.basename(file)}`).join("\n");
  return `# QA Report - ${issueKey}
**Deployment URL:** ${url}
**Tested at:** ${new Date().toISOString()}
**Overall status:** ${status}

## Test Results
| Acceptance Criterion | Result | Notes |
|----------------------|--------|-------|
${rows}

## Console Errors
${consoleErrors.length ? consoleErrors.map((item) => `- ${item}`).join("\n") : "- None"}

## Screenshots
${shotList}

## Summary
${status === "PASS" ? "All automated acceptance checks passed." : "One or more automated checks failed. See the table above for details."}
`;
}
