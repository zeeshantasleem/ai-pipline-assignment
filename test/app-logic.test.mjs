import test from "node:test";
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
});