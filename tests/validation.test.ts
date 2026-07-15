import { describe, expect, it } from "vitest";
import { getEntry } from "../src/core/registry.js";
import { validate } from "../src/helpers/validation.js";
import { ValidationError } from "../src/errors.js";

describe("validation", () => {
  it("throws when required params are missing", () => {
    const entry = getEntry("turnstile");
    expect(() => validate({ sitekey: "abc" }, entry)).toThrow(ValidationError);
    expect(() => validate({ sitekey: "abc" }, entry)).toThrow(/missing required parameter/);
    expect(() => validate({ sitekey: "abc" }, entry)).toThrow(/pageurl/);
  });

  it("treats blank strings as missing", () => {
    const entry = getEntry("recaptcha_v2");
    expect(() => validate({ googlekey: "   ", pageurl: "https://example.com" }, entry)).toThrow(
      ValidationError
    );
  });

  it("rejects invalid grid_size values", () => {
    const entry = getEntry("grid");
    expect(() =>
      validate(
        { image: "x", instructions: "select traffic lights", grid_size: "5x5" },
        entry
      )
    ).toThrow(ValidationError);
    expect(() =>
      validate(
        { image: "x", instructions: "select traffic lights", grid_size: "5x5" },
        entry
      )
    ).toThrow(/must be one of \[3x3, 4x4\]/);
  });

  it("accepts valid params for lemin", () => {
    const entry = getEntry("lemin");
    expect(() =>
      validate(
        { captcha_id: "cid", div_id: "div", pageurl: "https://example.com" },
        entry
      )
    ).not.toThrow();
  });
});
