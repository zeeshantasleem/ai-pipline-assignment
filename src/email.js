import fs from "node:fs";
import path from "node:path";

export async function sendQaEmail({ issueKey, status, reportPath, screenshots, config, to, dryRun }) {
  const body = fs.readFileSync(reportPath, "utf8");
  if (dryRun) {
    const out = path.join(path.dirname(reportPath), "email-preview.txt");
    fs.writeFileSync(out, `To: ${to || "dry-run@example.com"}\nSubject: QA Report - ${issueKey} - ${status}\n\n${body}`);
    return { sent: false, previewPath: out };
  }

  const attachments = screenshots.map((filePath) => ({
    filename: path.basename(filePath),
    content: fs.readFileSync(filePath).toString("base64")
  }));
  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${config.resendApiKey}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      from: config.from,
      to,
      subject: `QA Report - ${issueKey} - ${status}`,
      text: body,
      attachments
    })
  });
  if (!res.ok) throw new Error(`Resend email failed ${res.status}: ${await res.text()}`);
  return { sent: true, response: await res.json() };
}
