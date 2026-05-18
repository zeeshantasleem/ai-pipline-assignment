import fs from "node:fs";
import path from "node:path";
import { loadEnv, requireKeys } from "./config.js";
import { log } from "./log.js";
import { JiraClient, getDryRunIssue } from "./jira.js";
import { buildApp, prepareRun, runUnitTests } from "./builder.js";
import { pushAndOpenPr } from "./git-github.js";
import { deployToVercel } from "./vercel.js";
import { runQa } from "./qa.js";
import { sendQaEmail } from "./email.js";

const args = new Set(process.argv.slice(2));
const dryRun = args.has("--dry-run");
const once = args.has("--once");
const config = loadEnv();

requireKeys(config, dryRun);

async function main() {
  log(`Pipeline started (${dryRun ? "dry-run" : "live"} mode)`);
  if (once) {
    await tick();
    return;
  }

  await tick();
  setInterval(tick, config.pollIntervalMinutes * 60 * 1000);
}

async function tick() {
  log("Polling for ready Jira stories");
  if (dryRun) {
    const issue = await getDryRunIssue();
    await processIssue(issue);
    return;
  }

  const jira = new JiraClient(config.jira);
  const issues = await jira.searchReadyIssues();
  log(`Found ${issues.length} ready issue(s)`);
  for (const issue of issues) {
    const requirements = await jira.downloadRequirements(issue);
    await processIssue({ key: issue.key, summary: issue.fields.summary, requirements, jira });
  }
}

async function processIssue(issue) {
  const jira = issue.jira;
  const run = prepareRun(issue.key, issue.summary);
  fs.writeFileSync(path.join(run.runDir, "requirements.md"), issue.requirements);
  log(`${issue.key}: run directory created`, run.runDir);

  let finalStatus = "FAIL";
  let deploymentUrl = "";
  let prUrl = "";
  let reportPath = "";
  let closeDeployment = null;
  try {
    if (jira) {
      await jira.transition(issue.key, config.jira.inProgressTransition);
      await jira.comment(issue.key, `Pipeline picked up ${issue.key}. Run started at ${new Date().toISOString()}.`);
    }

    log(`${issue.key}: building app`);
    buildApp({ issueKey: issue.key, summary: issue.summary, requirements: issue.requirements, appDir: run.appDir });

    log(`${issue.key}: running unit tests`);
    const tests = runUnitTests(run.appDir);
    if (!tests.passed) throw new Error(`Unit tests failed. See ${tests.resultPath}`);
    copyIntoRun(tests.resultPath, run.runDir);

    log(`${issue.key}: pushing branch and opening PR`);
    const pr = await pushAndOpenPr({
      appDir: run.appDir,
      issueKey: issue.key,
      summary: issue.summary,
      config: config.github,
      dryRun
    });
    prUrl = pr.prUrl;

    log(`${issue.key}: deploying to Vercel`);
    const deployment = await deployToVercel({
      appDir: run.appDir,
      issueKey: issue.key,
      config: config.vercel,
      dryRun
    });
    deploymentUrl = deployment.deploymentUrl;
    closeDeployment = deployment.close;

    log(`${issue.key}: running Playwright QA against ${deploymentUrl}`);
    const qa = await runQa({ issueKey: issue.key, url: deploymentUrl, requirements: issue.requirements, runDir: run.runDir });
    finalStatus = qa.status;
    reportPath = qa.reportPath;

    log(`${issue.key}: emailing QA report`);
    await sendQaEmail({
      issueKey: issue.key,
      status: finalStatus,
      reportPath,
      screenshots: qa.screenshots,
      config: config.email,
      to: config.qaEmailTo,
      dryRun
    });

    if (jira) {
      const report = fs.readFileSync(reportPath, "utf8");
      await jira.comment(issue.key, `Pipeline complete.\n\nDeployment: ${deploymentUrl}\nPR: ${prUrl}\n\n${report}`);
      await jira.transition(issue.key, finalStatus === "PASS" ? config.jira.doneTransition : config.jira.bugTransition);
    }

    log(`${issue.key}: completed with ${finalStatus}`);
  } catch (error) {
    const failureReport = writeFailureReport(run.runDir, issue.key, error, deploymentUrl, prUrl);
    reportPath = failureReport;
    log(`${issue.key}: failed`, error.message);
    if (jira) {
      try {
        await sendQaEmail({
          issueKey: issue.key,
          status: "FAIL",
          reportPath: failureReport,
          screenshots: [],
          config: config.email,
          to: config.qaEmailTo,
          dryRun
        });
        await jira.comment(issue.key, fs.readFileSync(failureReport, "utf8"));
        await jira.transition(issue.key, config.jira.bugTransition);
      } catch (closeError) {
        log(`${issue.key}: failed while closing Jira loop`, closeError.message);
      }
    }
  } finally {
    if (closeDeployment) await closeDeployment();
  }
}

function copyIntoRun(filePath, runDir) {
  fs.copyFileSync(filePath, path.join(runDir, path.basename(filePath)));
}

function writeFailureReport(runDir, issueKey, error, deploymentUrl, prUrl) {
  const qaDir = path.join(runDir, "qa");
  fs.mkdirSync(qaDir, { recursive: true });
  const reportPath = path.join(qaDir, "bug-report.md");
  fs.writeFileSync(reportPath, `# QA Report - ${issueKey}
**Deployment URL:** ${deploymentUrl || "Not deployed"}
**Tested at:** ${new Date().toISOString()}
**Overall status:** FAIL

## Test Results
| Acceptance Criterion | Result | Notes |
|----------------------|--------|-------|
| Pipeline execution | FAIL | ${String(error.message).replace(/\|/g, "/")} |

## Console Errors
- Not available

## Screenshots
- None

## Summary
The pipeline failed before successful QA completion. PR: ${prUrl || "Not created"}.
`);
  return reportPath;
}

main().catch((error) => {
  log("Fatal pipeline error", error.message);
  process.exitCode = 1;
});
