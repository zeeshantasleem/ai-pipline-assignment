export function createTodoStore(initial = []) {
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
}