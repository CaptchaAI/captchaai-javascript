import { CaptchaTypeEntry } from "../core/registry.js";
import { SolveResult, SolveSolution } from "../core/result.js";
import { APIError } from "../errors.js";

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

export function buildResult(
  response: Record<string, unknown>,
  entry: CaptchaTypeEntry,
  taskId: string
): SolveResult {
  const answer = response[entry.solutionKey];
  if (answer === undefined || answer === null) {
    throw new APIError(`API response missing "${entry.solutionKey}" field`);
  }

  const rawText = typeof answer === "string" ? answer : undefined;
  let solution: SolveSolution;

  if (entry.isStructured) {
    if (typeof answer === "string") {
      try {
        const parsed: unknown = JSON.parse(answer);
        if (Array.isArray(parsed)) {
          solution = parsed.map(String);
        } else if (isRecord(parsed)) {
          solution = parsed;
        } else {
          throw new APIError("Structured response is not object/array");
        }
      } catch (error: unknown) {
        const msg = (error as Error).message;
        throw new APIError(`Could not parse structured answer as JSON: ${msg}`);
      }
    } else if (Array.isArray(answer)) {
      solution = answer.map(String);
    } else if (isRecord(answer)) {
      solution = answer;
    } else {
      throw new APIError("Structured response is not object/array");
    }
  } else {
    solution = String(answer);
  }

  return new SolveResult({
    taskId,
    solution,
    userAgent: entry.returnsUserAgent ? String(response.user_agent ?? "") || undefined : undefined,
    raw: response,
    rawText
  });
}
