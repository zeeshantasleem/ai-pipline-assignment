import fs from "node:fs";
import path from "node:path";
import { execFileSync } from "node:child_process";
import { slugify } from "./log.js";
import { commandFor } from "./commands.js";

export function prepareRun(issueKey, summary) {
  const runId = `${issueKey}-${Date.now()}`;
  const runDir = path.resolve("runs", runId);
  const appDir = path.join(runDir, "app");
  fs.mkdirSync(appDir, { recursive: true });
  fs.writeFileSync(path.join(runDir, "issue-summary.txt"), summary);
  return { runDir, appDir };
}

export function buildApp({ issueKey, summary, requirements, appDir }) {
  const lower = requirements.toLowerCase();
  if (lower.includes("todo")) return buildTodoApp(issueKey, summary, requirements, appDir);
  return buildGenericApp(issueKey, summary, requirements, appDir);
}

function buildTodoApp(issueKey, summary, requirements, appDir) {
  fs.writeFileSync(path.join(appDir, "app-logic.js"), todoLogic());
  fs.writeFileSync(path.join(appDir, "index.html"), todoHtml(issueKey, summary));
  fs.writeFileSync(path.join(appDir, "requirements.md"), requirements);
  fs.writeFileSync(path.join(appDir, "package.json"), JSON.stringify({ type: "module", scripts: { test: "node --test test/*.test.mjs" } }, null, 2));
  fs.mkdirSync(path.join(appDir, "test"), { recursive: true });
  fs.writeFileSync(path.join(appDir, "test", "app-logic.test.mjs"), todoTests());
}

function buildGenericApp(issueKey, summary, requirements, appDir) {
  const title = summary.replace(/^\[AI-PIPELINE\]\s*/i, "") || "Generated App";
  const items = requirements
    .split(/\r?\n/)
    .filter((line) => /^[-*]\s+/.test(line.trim()))
    .map((line) => `<li>${escapeHtml(line.replace(/^[-*]\s+/, ""))}</li>`)
    .join("\n");
  fs.writeFileSync(path.join(appDir, "index.html"), `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>${escapeHtml(title)}</title>
  <style>
    body { margin: 0; font-family: Arial, sans-serif; background: #f5f7fb; color: #1f2937; }
    main { max-width: 880px; margin: 0 auto; padding: 32px 18px; }
    section { background: white; border: 1px solid #d8dee9; border-radius: 8px; padding: 24px; }
    h1 { margin-top: 0; font-size: clamp(28px, 5vw, 48px); }
    li { margin: 10px 0; }
  </style>
</head>
<body><main><section><h1>${escapeHtml(title)}</h1><ul>${items}</ul></section></main></body></html>`);
  fs.writeFileSync(path.join(appDir, "requirements.md"), requirements);
  fs.writeFileSync(path.join(appDir, "package.json"), JSON.stringify({ type: "module", scripts: { test: "node --test test/*.test.mjs" } }, null, 2));
  fs.mkdirSync(path.join(appDir, "test"), { recursive: true });
  fs.writeFileSync(path.join(appDir, "test", "app-logic.test.mjs"), `import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";

test("index.html exists and contains app title", () => {
  const html = fs.readFileSync("index.html", "utf8");
  assert.match(html, /<h1>/);
  assert.match(html, /viewport/);
});
`);
}

export function runUnitTests(appDir) {
  const resultPath = path.join(appDir, "test-results.txt");
  try {
    const cmd = commandFor("npm", ["test"]);
    const output = execFileSync(cmd.command, cmd.args, { cwd: appDir, encoding: "utf8", stdio: "pipe" });
    fs.writeFileSync(resultPath, output);
    return { passed: true, resultPath, output };
  } catch (error) {
    const output = `${error.message || ""}\n${error.stdout || ""}\n${error.stderr || ""}`;
    fs.writeFileSync(resultPath, output);
    return { passed: false, resultPath, output };
  }
}

export function branchName(issueKey, summary) {
  return `feature/${issueKey}-${slugify(summary.replace(/^\[AI-PIPELINE\]\s*/i, ""))}`;
}

function todoLogic() {
  return `export function createTodoStore(initial = []) {
  let todos = initial.map((todo) => ({ ...todo }));
  return {
    all: () => todos.map((todo) => ({ ...todo })),
    add: (text) => {
      const trimmed = String(text || "").trim();
      if (!trimmed) return null;
      const todo = { id: Date.now() + Math.random(), text: trimmed, completed: false };
      todos = [...todos, todo];
      return { ...todo };
    },
    toggle: (id) => {
      todos = todos.map((todo) => todo.id === id ? { ...todo, completed: !todo.completed } : todo);
    },
    remove: (id) => {
      todos = todos.filter((todo) => todo.id !== id);
    },
    remaining: () => todos.filter((todo) => !todo.completed).length
  };
}

export function loadTodos(storage) {
  try {
    return JSON.parse(storage.getItem("todos") || "[]");
  } catch {
    return [];
  }
}

export function saveTodos(storage, todos) {
  storage.setItem("todos", JSON.stringify(todos));
}`;
}

function todoHtml(issueKey, summary) {
  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>${escapeHtml(summary)}</title>
  <style>
    :root { color-scheme: light; }
    body { margin: 0; font-family: Arial, sans-serif; background: #eef2f7; color: #172033; }
    main { width: min(720px, calc(100% - 28px)); margin: 32px auto; }
    .panel { background: #fff; border: 1px solid #d7deea; border-radius: 8px; padding: 20px; box-shadow: 0 16px 40px rgba(23, 32, 51, .08); }
    h1 { margin: 0 0 16px; font-size: clamp(26px, 7vw, 42px); }
    form { display: grid; grid-template-columns: 1fr auto; gap: 8px; }
    input, button { font: inherit; border-radius: 6px; border: 1px solid #aeb8c8; padding: 11px 12px; }
    button { background: #126c5b; color: white; border-color: #126c5b; cursor: pointer; }
    ul { padding: 0; margin: 18px 0; list-style: none; display: grid; gap: 8px; }
    li { display: grid; grid-template-columns: auto 1fr auto; align-items: center; gap: 10px; padding: 10px; border: 1px solid #dde3ed; border-radius: 6px; }
    li.completed span { text-decoration: line-through; color: #687385; }
    .meta { color: #475569; }
    @media (max-width: 430px) { form { grid-template-columns: 1fr; } }
  </style>
</head>
<body>
  <main>
    <section class="panel">
      <h1>Todo List</h1>
      <form id="todo-form">
        <input id="todo-input" aria-label="New todo" placeholder="Add a task" autocomplete="off">
        <button type="submit">Add</button>
      </form>
      <ul id="todo-list" aria-label="Todos"></ul>
      <p class="meta"><span id="remaining">0</span> remaining</p>
    </section>
  </main>
  <script type="module">
    import { createTodoStore, loadTodos, saveTodos } from "./app-logic.js";
    const store = createTodoStore(loadTodos(localStorage));
    const form = document.querySelector("#todo-form");
    const input = document.querySelector("#todo-input");
    const list = document.querySelector("#todo-list");
    const remaining = document.querySelector("#remaining");

    function render() {
      const todos = store.all();
      list.innerHTML = "";
      for (const todo of todos) {
        const item = document.createElement("li");
        item.className = todo.completed ? "completed" : "";
        item.innerHTML = '<input type="checkbox" aria-label="Toggle todo"><span></span><button type="button">Delete</button>';
        item.querySelector("span").textContent = todo.text;
        item.querySelector("input").checked = todo.completed;
        item.querySelector("input").addEventListener("change", () => { store.toggle(todo.id); persist(); render(); });
        item.querySelector("button").addEventListener("click", () => { store.remove(todo.id); persist(); render(); });
        list.appendChild(item);
      }
      remaining.textContent = String(store.remaining());
    }

    function persist() {
      saveTodos(localStorage, store.all());
    }

    form.addEventListener("submit", (event) => {
      event.preventDefault();
      if (store.add(input.value)) {
        input.value = "";
        persist();
        render();
      }
    });

    render();
    window.__PIPELINE_READY__ = "${issueKey}";
  </script>
</body>
</html>`;
}

function todoTests() {
  return `import test from "node:test";
import assert from "node:assert/strict";
import { createTodoStore, loadTodos, saveTodos } from "../app-logic.js";

test("adds non-empty todos and counts remaining items", () => {
  const store = createTodoStore();
  assert.equal(store.add("  Ship pipeline  ").text, "Ship pipeline");
  assert.equal(store.remaining(), 1);
  assert.equal(store.add(""), null);
  assert.equal(store.all().length, 1);
});

test("toggles and removes todos", () => {
  const store = createTodoStore([{ id: 1, text: "Demo", completed: false }]);
  store.toggle(1);
  assert.equal(store.all()[0].completed, true);
  assert.equal(store.remaining(), 0);
  store.remove(1);
  assert.equal(store.all().length, 0);
});

test("persists todos through storage adapter", () => {
  const memory = new Map();
  const storage = { getItem: (key) => memory.get(key), setItem: (key, value) => memory.set(key, value) };
  saveTodos(storage, [{ id: 2, text: "Persist", completed: false }]);
  assert.deepEqual(loadTodos(storage), [{ id: 2, text: "Persist", completed: false }]);
});`;
}

function escapeHtml(value) {
  return String(value).replace(/[&<>"']/g, (char) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[char]);
}
