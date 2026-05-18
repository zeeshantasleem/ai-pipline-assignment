export function log(message, data) {
  const stamp = new Date().toISOString();
  if (data === undefined) {
    console.log(`[${stamp}] ${message}`);
  } else {
    console.log(`[${stamp}] ${message}`, data);
  }
}

export function slugify(value) {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 48) || "generated-app";
}
