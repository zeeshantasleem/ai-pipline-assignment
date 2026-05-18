import fs from "node:fs";
import http from "node:http";
import path from "node:path";

export async function deployToVercel({ appDir, issueKey, config, dryRun }) {
  if (dryRun) {
    const local = await startStaticServer(appDir);
    return { deploymentUrl: local.url, deploymentId: "dry-run", close: local.close };
  }

  const files = listFiles(appDir).map((filePath) => ({
    file: path.relative(appDir, filePath).replace(/\\/g, "/"),
    data: fs.readFileSync(filePath, "base64"),
    encoding: "base64"
  }));

  const query = config.orgId ? `?teamId=${encodeURIComponent(config.orgId)}` : "";
  const res = await fetch(`https://api.vercel.com/v13/deployments${query}`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${config.token}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      name: `pipeline-${issueKey.toLowerCase()}`,
      project: config.projectId,
      target: "preview",
      files,
      projectSettings: { framework: null, buildCommand: null, outputDirectory: "." }
    })
  });
  if (!res.ok) throw new Error(`Vercel deployment failed ${res.status}: ${await res.text()}`);
  const created = await res.json();
  const ready = await waitForDeployment(created.id, config);
  const url = `https://${ready.url || created.url}`;
  await healthCheck(url);
  return { deploymentUrl: url, deploymentId: created.id };
}

async function waitForDeployment(id, config) {
  const query = config.orgId ? `?teamId=${encodeURIComponent(config.orgId)}` : "";
  const deadline = Date.now() + 1000 * 60 * 8;
  while (Date.now() < deadline) {
    const res = await fetch(`https://api.vercel.com/v13/deployments/${id}${query}`, {
      headers: { Authorization: `Bearer ${config.token}` }
    });
    if (!res.ok) throw new Error(`Vercel poll failed ${res.status}: ${await res.text()}`);
    const deployment = await res.json();
    if (deployment.readyState === "READY" || deployment.status === "READY") return deployment;
    if (["ERROR", "CANCELED"].includes(deployment.readyState || deployment.status)) {
      throw new Error(`Vercel deployment ended as ${deployment.readyState || deployment.status}`);
    }
    await wait(5000);
  }
  throw new Error("Timed out waiting for Vercel deployment");
}

async function healthCheck(url) {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Health check failed for ${url}: ${res.status}`);
}

function listFiles(dir) {
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) return listFiles(full);
    return full;
  });
}

function wait(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function startStaticServer(root) {
  const server = http.createServer((req, res) => {
    const requestPath = decodeURIComponent(new URL(req.url, "http://localhost").pathname);
    const safePath = path.normalize(requestPath).replace(/^(\.\.[/\\])+/, "");
    const filePath = path.join(root, safePath === path.sep || safePath === "/" ? "index.html" : safePath);
    if (!filePath.startsWith(root) || !fs.existsSync(filePath) || fs.statSync(filePath).isDirectory()) {
      res.writeHead(404);
      res.end("Not found");
      return;
    }
    const ext = path.extname(filePath);
    const contentType = ext === ".js" ? "text/javascript" : ext === ".css" ? "text/css" : ext === ".html" ? "text/html" : "application/octet-stream";
    res.writeHead(200, { "Content-Type": contentType });
    fs.createReadStream(filePath).pipe(res);
  });

  return new Promise((resolve) => {
    server.listen(0, "127.0.0.1", () => {
      const address = server.address();
      resolve({
        url: `http://127.0.0.1:${address.port}/`,
        close: () => new Promise((done) => server.close(done))
      });
    });
  });
}
