const RENAME: Record<string, string> = {
  url: "pageurl",
  user_agent: "userAgent",
  api_server: "apiServer"
};

export function normalise(params: Record<string, unknown>): Record<string, string> {
  const out: Record<string, string> = {};
  for (const [key, value] of Object.entries(params)) {
    if (value === null || value === undefined) continue;
    const apiKey = RENAME[key] ?? key;
    if (typeof value === "boolean") {
      out[apiKey] = value ? "1" : "0";
      continue;
    }
    if (Array.isArray(value) || typeof value === "object") {
      out[apiKey] = JSON.stringify(value);
      continue;
    }
    out[apiKey] = String(value);
  }
  return out;
}
