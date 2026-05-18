# Zero Human Touch Pipeline

This project implements the take-home assignment pipeline:

1. Poll Jira every 5 minutes for `ai-ready` stories in `To Do`.
2. Download `requirements.md`.
3. Transition Jira to `In Progress`.
4. Build a deployable static app.
5. Generate and run unit tests until passing.
6. Push a GitHub branch and open a PR.
7. Deploy to Vercel and wait for a live URL.
8. Run Playwright QA against the deployed URL.
9. Email `bug-report.md` with screenshots.
10. Transition Jira to `Done` or `Bug Reported`.

## Tonight's Setup Checklist

- Jira project with statuses: `To Do`, `In Progress`, `Done`, and ideally `Bug Reported`.
- Jira API token from Atlassian account security.
- GitHub personal access token with repo permissions.
- Existing empty GitHub repo URL.
- Vercel token plus project/org IDs.
- Resend API key and verified sender, or use `onboarding@resend.dev` for test emails.
- Run `npm install`.
- Copy `.env.example` to `.env` and fill values.
- Test locally with `npm run dry-run`.
- Start unattended polling with `npm start`.

## Recording Flow

Create a Jira story titled `[AI-PIPELINE] Simple Todo App`, label it `ai-ready`, attach a file named exactly `requirements.md`, then stop touching the keyboard. Show the terminal logs, GitHub PR, Vercel deployment URL, Playwright browser/screenshot output, received email, and final Jira status.

## Commands

```bash
npm install
npm run dry-run
npm run once
npm start
```
