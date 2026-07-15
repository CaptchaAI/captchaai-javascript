import { describe, expect, it } from "vitest";
import { resolve } from "../src/helpers/image.js";
import { ValidationError } from "../src/errors.js";
import { MINIMAL_PNG, MINIMAL_PNG_BASE64 } from "./helpers/fixtures.js";

describe("image.resolve", () => {
  it("encodes Uint8Array image input to base64 body", async () => {
    const params: Record<string, unknown> = { image: MINIMAL_PNG };
    await resolve(params);
    expect(params.image).toBeUndefined();
    expect(params.body).toBe(MINIMAL_PNG_BASE64);
  });

  it("accepts base64 string image input", async () => {
    const params: Record<string, unknown> = { image: MINIMAL_PNG_BASE64 };
    await resolve(params);
    expect(params.body).toBe(MINIMAL_PNG_BASE64);
  });

  it("requires image for single-image captchas", async () => {
    await expect(resolve({})).rejects.toThrow(ValidationError);
    await expect(resolve({})).rejects.toThrow(/'image' is required/);
  });

  it("rejects invalid image types", async () => {
    await expect(resolve({ image: 42 })).rejects.toThrow(ValidationError);
    await expect(resolve({ image: 42 })).rejects.toThrow(/must be string/);
  });

  it("requires exactly 9 images for BLS", async () => {
    await expect(resolve({ images: [] })).rejects.toThrow(/non-empty list/);
    await expect(resolve({ images: [MINIMAL_PNG] })).rejects.toThrow(/exactly 9 images/);
  });

  it("maps 9 BLS images to image_base64_N fields", async () => {
    const images = Array.from({ length: 9 }, () => MINIMAL_PNG);
    const params: Record<string, unknown> = { images };
    await resolve(params);
    expect(params.images).toBeUndefined();
    for (let i = 1; i <= 9; i += 1) {
      expect(params[`image_base64_${i}`]).toMatch(/^data:image\/png;base64,/);
    }
  });

  it("rejects oversized PNG dimensions", async () => {
    const oversized = Buffer.from(MINIMAL_PNG);
    oversized.writeUInt32BE(2000, 16);
    oversized.writeUInt32BE(2000, 20);
    await expect(resolve({ image: new Uint8Array(oversized) })).rejects.toThrow(ValidationError);
    await expect(resolve({ image: new Uint8Array(oversized) })).rejects.toThrow(/exceed the 1000px/);
  });
});
