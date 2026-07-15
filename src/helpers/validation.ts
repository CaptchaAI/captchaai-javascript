import { CaptchaTypeEntry } from "../core/registry.js";
import { ValidationError } from "../errors.js";

export function validate(params: Record<string, unknown>, entry: CaptchaTypeEntry): void {
  const missing = entry.requiredParams.filter((name) => {
    const value = params[name];
    if (value === null || value === undefined) return true;
    if (typeof value === "string") return value.trim().length === 0;
    return false;
  });

  if (missing.length > 0) {
    throw new ValidationError(
      `${entry.name}: missing required parameter(s): ${missing.join(", ")}`
    );
  }

  if (entry.validValues) {
    for (const [paramName, allowed] of Object.entries(entry.validValues)) {
      const value = params[paramName];
      if (value !== undefined && value !== null && !allowed.includes(String(value))) {
        throw new ValidationError(
          `${entry.name}: '${paramName}' must be one of [${allowed.join(", ")}], got ${String(value)}`
        );
      }
    }
  }
}
