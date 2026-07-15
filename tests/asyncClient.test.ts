import { describe, expect, it } from "vitest";
import { AsyncCaptchaAI } from "../src/async-client.js";
import { VALID_API_KEY } from "./helpers/fixtures.js";
import { captureRequests, installMockFetch } from "./helpers/mockFetch.js";
import { advanceTimers, useFakeTimers } from "./helpers/timers.js";

describe("AsyncCaptchaAI", () => {
  it("create waits for client initialization via threadsInfo", async () => {
    const capture = captureRequests();
    capture.install();
    const client = await AsyncCaptchaAI.create({ apiKey: VALID_API_KEY });
    expect(capture.requests.some((request) => request.body.action === "threadsinfo")).toBe(true);
    await client.aclose();
  });

  it("delegates solve methods to the underlying CaptchaAI client", async () => {
    useFakeTimers();
    installMockFetch({ solution: "async-token" });
    const client = await AsyncCaptchaAI.create({
      apiKey: VALID_API_KEY,
      jitterMaxSeconds: 0,
      maxPollSeconds: 30
    });

    const resultPromise = client.turnstile("site", "https://example.com");
    await advanceTimers(30_000);
    const result = await resultPromise;
    expect(result.solution).toBe("async-token");
    await client.aclose();
  });

  it("aclose shuts down the wrapped client", async () => {
    installMockFetch();
    const client = await AsyncCaptchaAI.create({ apiKey: VALID_API_KEY });
    await expect(client.aclose()).resolves.toBeUndefined();
  });
});
