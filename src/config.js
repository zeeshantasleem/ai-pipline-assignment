import fs from "node:fs";
import path from "node:path";

export function loadEnv() {
  const envPath = path.resolve(".env");
  if (fs.existsSync(envPath)) {
    const lines = fs.readFileSync(envPath, "utf8").split(/\r?\n/);
    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith("#") || !trimmed.includes("=")) continue;
      const [key, ...rest] = trimmed.split("=");
      if (!process.env[key]) process.env[key] = rest.join("=").trim();
    }
  }

  return {
    pollIntervalMinutes: Number(process.env.POLL_INTERVAL_MINUTES || 5),
    qaEmailTo: process.env.QA_EMAIL_TO,
    jira: {
      baseUrl: trimSlash(process.env.JIRA_BASE_URL || ""),
      email: process.env.JIRA_EMAIL,
      token: process.env.JIRA_API_TOKEN,
      projectKey: process.env.JIRA_PROJECT_KEY,
      readyLabel: process.env.JIRA_READY_LABEL || "ai-ready",
      todoStatus: process.env.JIRA_TODO_STATUS || "To Do",
      inProgressTransition: process.env.JIRA_IN_PROGRESS_TRANSITION || "In Progress",
      doneTransition: process.env.JIRA_DONE_TRANSITION || "Done",
      bugTransition: process.env.JIRA_BUG_TRANSITION || "Bug Reported"
    },
    github: {
      token: process.env.GITHUB_TOKEN,
      owner: process.env.GITHUB_OWNER,
      repo: process.env.GITHUB_REPO,
      remoteUrl: process.env.GIT_REMOTE_URL
    },
    vercel: {
      token: process.env.VERCEL_TOKEN,
      projectId: process.env.VERCEL_PROJECT_ID,
      orgId: process.env.VERCEL_ORG_ID
    },
    email: {
      resendApiKey: process.env.RESEND_API_KEY,
      from: process.env.EMAIL_FROM || "Pipeline <onboarding@resend.dev>"
    }
  };
}

function trimSlash(value) {
  return value.replace(/\/+$/, "");
}

export function requireKeys(config, dryRun) {
  if (dryRun) return;
  const missing = [];
  const checks = {
    JIRA_BASE_URL: config.jira.baseUrl,
    JIRA_EMAIL: config.jira.email,
    JIRA_API_TOKEN: config.jira.token,
    JIRA_PROJECT_KEY: config.jira.projectKey,
    GITHUB_TOKEN: config.github.token,
    GITHUB_OWNER: config.github.owner,
    GITHUB_REPO: config.github.repo,
    GIT_REMOTE_URL: config.github.remoteUrl,
    VERCEL_TOKEN: config.vercel.token,
    VERCEL_PROJECT_ID: config.vercel.projectId,
    RESEND_API_KEY: config.email.resendApiKey,
    QA_EMAIL_TO: config.qaEmailTo
  };
  for (const [key, value] of Object.entries(checks)) {
    if (!value) missing.push(key);
  }
  if (missing.length) {
    throw new Error(`Missing required .env values: ${missing.join(", ")}`);
  }
}
