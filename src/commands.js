export function bin(name) {
  if (process.platform === "win32" && ["npm", "npx"].includes(name)) return `${name}.cmd`;
  return name;
}

export function commandFor(name, args) {
  if (process.platform === "win32" && ["npm", "npx"].includes(name)) {
    return { command: "cmd.exe", args: ["/c", name, ...args] };
  }
  return { command: name, args };
}
