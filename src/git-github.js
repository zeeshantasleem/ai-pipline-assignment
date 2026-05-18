import { execFileSync } from "node:child_process";
import { branchName } from "./builder.js";

export async function pushAndOpenPr({ appDir, issueKey, summary, config, dryRun }) {
  const branch = branchName(issueKey, summary);
  const commitMessage = `${issueKey}: build ${summary.replace(/^\[AI-PIPELINE\]\s*/i, "")}`;

  if (dryRun) {
    return {
      branch,
      prUrl: `https://github.com/${config.owner || "demo"}/${config.repo || "repo"}/pull/dry-run`
    };
  }

  run("git", ["init"], appDir);
  run("git", ["checkout", "-b", branch], appDir);
  run("git", ["add", "."], appDir);
  run("git", ["commit", "-m", commitMessage], appDir);
  run("git", ["remote", "add", "origin", config.remoteUrl], appDir);
  run("git", ["push", "-u", "origin", branch], appDir);

  const res = await fetch(`https://api.github.com/repos/${config.owner}/${config.repo}/pulls`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${config.token}`,
      Accept: "application/vnd.github+json",
      "X-GitHub-Api-Version": "2022-11-28",
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      title: `${issueKey}: ${summary.replace(/^\[AI-PIPELINE\]\s*/i, "")}`,
      head: branch,
      base: "main",
      body: `Automated pipeline output for ${issueKey}.\n\nGenerated app, unit test results, and QA report are included in this branch.`
    })
  });

  if (!res.ok) throw new Error(`GitHub PR creation failed ${res.status}: ${await res.text()}`);
  const pr = await res.json();
  return { branch, prUrl: pr.html_url };
}

function run(command, args, cwd) {
  return execFileSync(command, args, { cwd, encoding: "utf8", stdio: "pipe" });
}
