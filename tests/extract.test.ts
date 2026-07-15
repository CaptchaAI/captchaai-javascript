import { describe, expect, it } from "vitest";
import { buildResult } from "../src/helpers/extract.js";
import { getEntry } from "../src/core/registry.js";
import { APIError } from "../src/errors.js";

describe("extract.buildResult", () => {
  it("returns a plain string solution from request field", () => {
    const entry = getEntry("turnstile");
    const result = buildResult({ status: 1, request: "turnstile-token" }, entry, "99");
    expect(result.taskId).toBe("99");
    expect(result.solution).toBe("turnstile-token");
    expect(result.userAgent).toBeUndefined();
  });

  it("parses structured JSON string solutions", () => {
    const entry = getEntry("grid");
    const result = buildResult(
      { status: 1, request: '["1","0","1"]' },
      entry,
      "42"
    );
    expect(result.solution).toEqual(["1", "0", "1"]);
  });

  it("includes userAgent for enterprise types", () => {
    const entry = getEntry("recaptcha_v2_enterprise");
    const result = buildResult(
      { status: 1, result: "enterprise-token", user_agent: "UA/1.0" },
      entry,
      "7"
    );
    expect(result.solution).toBe("enterprise-token");
    expect(result.userAgent).toBe("UA/1.0");
  });

  it("throws when the solution field is missing", () => {
    const entry = getEntry("normal");
    expect(() => buildResult({ status: 1 }, entry, "1")).toThrow(APIError);
    expect(() => buildResult({ status: 1 }, entry, "1")).toThrow(/missing "request" field/);
  });

  it("throws when structured JSON cannot be parsed", () => {
    const entry = getEntry("geetest");
    expect(() => buildResult({ status: 1, request: "not-json" }, entry, "3")).toThrow(APIError);
    expect(() => buildResult({ status: 1, request: "not-json" }, entry, "3")).toThrow(
      /Could not parse structured answer/
    );
  });
});
