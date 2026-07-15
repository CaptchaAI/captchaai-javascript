import { describe, expect, it } from "vitest";
import { getEntry, REGISTRY } from "../src/core/registry.js";
import { ValidationError } from "../src/errors.js";

describe("registry", () => {
  it("defines all 14 captcha types", () => {
    expect(Object.keys(REGISTRY)).toHaveLength(14);
  });

  it.each(Object.keys(REGISTRY))("getEntry(%s) returns the matching entry", (name) => {
    const entry = getEntry(name);
    expect(entry.name).toBe(name);
    expect(entry.apiMethod).toBe(REGISTRY[name]?.apiMethod);
    expect(entry.requiredParams).toEqual(REGISTRY[name]?.requiredParams);
  });

  it("throws ValidationError for unknown captcha types", () => {
    expect(() => getEntry("not_a_real_type")).toThrow(ValidationError);
    expect(() => getEntry("not_a_real_type")).toThrow(/Unknown captcha type/);
  });

  it("marks proxy-required types correctly", () => {
    expect(getEntry("cloudflare_challenge").requiresProxy).toBe(true);
    expect(getEntry("captchafox").requiresProxy).toBe(true);
    expect(getEntry("normal").requiresProxy).toBeUndefined();
  });

  it("restricts grid_size values", () => {
    expect(getEntry("grid").validValues?.grid_size).toEqual(["3x3", "4x4"]);
  });
});
