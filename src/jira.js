import fs from "node:fs";
import { log } from "./log.js";

export class JiraClient {
  constructor(config) {
    this.config = config;
  }

  async searchReadyIssues() {
    const jql = `project = ${this.config.projectKey} AND labels = ${this.config.readyLabel} AND status = "${this.config.todoStatus}"`;
    const url = `${this.config.baseUrl}/rest/api/3/search?jql=${encodeURIComponent(jql)}&fields=summary,attachment`;
    const data = await this.request(url);
    return data.issues || [];
  }

  async downloadRequirements(issue) {
    const attachments = issue.fields?.attachment || [];
    const attachment = attachments.find((item) => item.filename === "requirements.md");
    if (!attachment) throw new Error(`${issue.key} does not have requirements.md attached`);
    const res = await fetch(attachment.content, { headers: this.headers() });
    if (!res.ok) throw new Error(`Could not download requirements.md: ${res.status} ${await res.text()}`);
    return await res.text();
  }

  async transition(issueKey, transitionName) {
    const transitions = await this.request(`${this.config.baseUrl}/rest/api/3/issue/${issueKey}/transitions`);
    const match = transitions.transitions?.find((item) => item.name.toLowerCase() === transitionName.toLowerCase());
    if (!match) throw new Error(`Transition "${transitionName}" not found for ${issueKey}`);
    await this.request(`${this.config.baseUrl}/rest/api/3/issue/${issueKey}/transitions`, {
      method: "POST",
      body: JSON.stringify({ transition: { id: match.id } })
    });
  }

  async comment(issueKey, body) {
    await this.request(`${this.config.baseUrl}/rest/api/3/issue/${issueKey}/comment`, {
      method: "POST",
      body: JSON.stringify({
        body: {
          type: "doc",
          version: 1,
          content: [{ type: "paragraph", content: [{ type: "text", text: body.slice(0, 30000) }] }]
        }
      })
    });
  }

  async request(url, options = {}) {
    const res = await fetch(url, {
      ...options,
      headers: { "Content-Type": "application/json", ...this.headers(), ...(options.headers || {}) }
    });
    if (!res.ok) throw new Error(`Jira API failed ${res.status}: ${await res.text()}`);
    if (res.status === 204) return {};
    return await res.json();
  }

  headers() {
    const auth = Buffer.from(`${this.config.email}:${this.config.token}`).toString("base64");
    return { Authorization: `Basic ${auth}`, Accept: "application/json" };
  }
}

export async function getDryRunIssue() {
  const requirements = fs.readFileSync("samples/requirements.md", "utf8");
  log("Loaded dry-run requirements from samples/requirements.md");
  return {
    key: "DEMO-1",
    summary: "[AI-PIPELINE] Simple Todo App",
    requirements
  };
}
