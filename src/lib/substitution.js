const VAR_RE = /\[([A-Z0-9_][A-Z0-9_ ]*)\]/g;

export function extractVars(text) {
  const matches = [...(text || '').matchAll(VAR_RE)];
  return [...new Set(matches.map(m => m[1]))];
}

export function applyVars(text, values) {
  return (text || '').replace(VAR_RE, (_, k) => values[k] !== undefined && values[k] !== '' ? values[k] : `[${k}]`);
}
