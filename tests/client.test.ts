import { describe, expect, it, vi } from "vitest";
import { CaptchaAI } from "../src/client.js";
import {
  InvalidKeyError,
  ThreadLimitError,
  ValidationError
} from "../src/errors.js";
import {
  makeBlsImages,
  MINIMAL_PNG,
  VALID_API_KEY
} from "./helpers/fixtures.js";
import { captureRequests, installMockFetch } from "./helpers/mockFetch.js";
import { advanceTimers, useFakeTimers } from "./helpers/timers.js";

function submitRequest(
  requests: Array<{ method: string; url: string; body: Record<string, string> }>
) {
  return requests.find((request) => request.url.includes("in.php"));
}

describe("CaptchaAI", () => {
  it("throws InvalidKeyError for non-32-character API keys", () => {
    expect(() => new CaptchaAI({ apiKey: "short" })).toThrow(InvalidKeyError);
  });

  it("throws ValidationError when proxy is set without proxyType", () => {
    expect(
      () =>
        new CaptchaAI({
          apiKey: VALID_API_KEY,
          proxy: "user:pass@host:8080"
        })
    ).toThrow(ValidationError);
    expect(
      () =>
        new CaptchaAI({
          apiKey: VALID_API_KEY,
          proxy: "user:pass@host:8080"
        })
    ).toThrow(/proxyType is required/);
  });

  it("threadsInfo returns account thread usage", async () => {
    installMockFetch({ threads: 8, workingThreads: 2 });
    const client = new CaptchaAI({ apiKey: VALID_API_KEY });
    await expect(client.threadsInfo()).resolves.toEqual({
      threads: 8,
      workingThreads: 2
    });
    await client.close();
  });

  it("send and getResult expose the low-level task flow", async () => {
    useFakeTimers();
    const capture = captureRequests();
    capture.install({ solution: "manual-token" });
    const client = new CaptchaAI({
      apiKey: VALID_API_KEY,
      jitterMaxSeconds: 0,
      maxPollSeconds: 30
    });

    const taskIdPromise = client.send("turnstile", {
      sitekey: "site-key",
      pageurl: "https://example.com"
    });
    await advanceTimers(20_000);
    const taskId = await taskIdPromise;
    expect(taskId).toBe("12345678");

    const resultPromise = client.getResult("turnstile", taskId);
    await advanceTimers(20_000);
    const result = await resultPromise;
    expect(result.solution).toBe("manual-token");
    await client.close();
  });

  it("throws ThreadLimitError when autoRetry is false and the local cap is reached", async () => {
    let releaseSubmit: (() => void) | undefined;
    let submitStarted = false;
    const submitGate = new Promise<void>((resolve) => {
      releaseSubmit = resolve;
    });

    vi.stubGlobal(
      "fetch",
      vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
        const url = String(input);
        const method = init?.method ?? "GET";
        const body =
          method === "GET"
            ? Object.fromEntries(new URL(url).searchParams.entries())
            : Object.fromEntries(new URLSearchParams(String(init?.body ?? "")).entries());

        if (url.includes("res.php") && body.action === "threadsinfo") {
          return new Response(
            JSON.stringify({ status: 1, threads: 1, working_threads: 0 }),
            { status: 200, headers: { "Content-Type": "application/json" } }
          );
        }

        if (url.includes("in.php")) {
          submitStarted = true;
          await submitGate;
          return new Response(JSON.stringify({ status: 1, request: "1" }), {
            status: 200,
            headers: { "Content-Type": "application/json" }
          });
        }

        return new Response(JSON.stringify({ status: 1, request: "token" }), {
          status: 200,
          headers: { "Content-Type": "application/json" }
        });
      })
    );

    const client = new CaptchaAI({
      apiKey: VALID_API_KEY,
      autoRetry: false,
      maxRetries: 0,
      jitterMaxSeconds: 0,
      maxPollSeconds: 30
    });

    const first = client.turnstile("site", "https://example.com");
    await vi.waitFor(() => submitStarted);
    await expect(client.turnstile("site", "https://example.com")).rejects.toThrow(
      ThreadLimitError
    );
    releaseSubmit?.();
    first.catch(() => undefined);
    await client.close();
  });

  const solveCases = [
    {
      name: "normal",
      run: (client: CaptchaAI) => client.normal(MINIMAL_PNG),
      expectedMethod: "base64",
      expectedHttpMethod: "POST"
    },
    {
      name: "grid",
      run: (client: CaptchaAI) =>
        client.grid(MINIMAL_PNG, "select cars", "3x3"),
      expectedMethod: "base64",
      expectedHttpMethod: "POST",
      solution: '["1","0"]'
    },
    {
      name: "bls",
      run: (client: CaptchaAI) => client.bls(makeBlsImages(), "select all buses"),
      expectedMethod: "bls",
      expectedHttpMethod: "POST",
      solution: '["1","2","3"]'
    },
    {
      name: "recaptcha_v2",
      run: (client: CaptchaAI) => client.recaptchaV2("google-key", "https://example.com"),
      expectedMethod: "userrecaptcha",
      expectedHttpMethod: "GET"
    },
    {
      name: "recaptcha_v2_invisible",
      run: (client: CaptchaAI) =>
        client.recaptchaV2("google-key", "https://example.com", { invisible: true }),
      expectedMethod: "userrecaptcha",
      expectedHttpMethod: "GET"
    },
    {
      name: "recaptcha_v2_enterprise",
      run: (client: CaptchaAI) =>
        client.recaptchaV2("google-key", "https://example.com", { enterprise: true }),
      expectedMethod: "userrecaptcha",
      expectedHttpMethod: "POST",
      solutionKey: "result" as const
    },
    {
      name: "recaptcha_v3",
      run: (client: CaptchaAI) =>
        client.recaptchaV3("google-key", "https://example.com", { action: "login" }),
      expectedMethod: "userrecaptcha",
      expectedHttpMethod: "GET"
    },
    {
      name: "recaptcha_v3_enterprise",
      run: (client: CaptchaAI) =>
        client.recaptchaV3("google-key", "https://example.com", {
          action: "login",
          enterprise: true
        }),
      expectedMethod: "userrecaptcha",
      expectedHttpMethod: "POST",
      solutionKey: "result" as const
    },
    {
      name: "turnstile",
      run: (client: CaptchaAI) => client.turnstile("turnstile-key", "https://example.com"),
      expectedMethod: "turnstile",
      expectedHttpMethod: "GET"
    },
    {
      name: "cloudflare_challenge",
      run: (client: CaptchaAI) => client.cloudflareChallenge("https://example.com"),
      expectedMethod: "cloudflare_challenge",
      expectedHttpMethod: "POST",
      solutionKey: "result" as const,
      clientOptions: {
        proxy: "user:pass@host:8080",
        proxyType: "HTTP" as const
      }
    },
    {
      name: "geetest",
      run: (client: CaptchaAI) =>
        client.geetest("gt-value", "challenge-value", "https://example.com"),
      expectedMethod: "geetest",
      expectedHttpMethod: "GET",
      solution: '{"validate":"ok"}'
    },
    {
      name: "captchafox",
      run: (client: CaptchaAI) => client.captchafox("fox-key", "https://example.com"),
      expectedMethod: "captchafox",
      expectedHttpMethod: "GET",
      clientOptions: {
        proxy: "user:pass@host:8080",
        proxyType: "HTTP" as const
      }
    },
    {
      name: "friendly_captcha",
      run: (client: CaptchaAI) =>
        client.friendlyCaptcha("friendly-key", "https://example.com", { version: "v2" }),
      expectedMethod: "friendly_captcha",
      expectedHttpMethod: "GET"
    },
    {
      name: "lemin",
      run: (client: CaptchaAI) =>
        client.lemin("captcha-id", "div-id", "https://example.com", { apiServer: "api.lemin.com" }),
      expectedMethod: "lemin",
      expectedHttpMethod: "GET",
      solution: '{"answer":"ok"}'
    }
  ] as const;

  it.each(solveCases)(
    "solves $name through the public API",
    async ({
      run,
      expectedMethod,
      expectedHttpMethod,
      solution,
      solutionKey,
      clientOptions
    }) => {
      useFakeTimers();
      const capture = captureRequests();
      capture.install({
        solution: solution ?? "solved-token",
        solutionKey: solutionKey ?? "request"
      });

      const client = new CaptchaAI({
        apiKey: VALID_API_KEY,
        jitterMaxSeconds: 0,
        maxPollSeconds: 30,
        ...clientOptions
      });

      const resultPromise = run(client);
      await advanceTimers(30_000);
      const result = await resultPromise;

      expect(result.solution).toBeDefined();
      const submit = submitRequest(capture.requests);
      expect(submit?.method).toBe(expectedHttpMethod);
      expect(submit?.body.method).toBe(expectedMethod);
      await client.close();
    }
  );

  it("throws ValidationError for per-call proxy without proxyType", async () => {
    installMockFetch();
    const client = new CaptchaAI({ apiKey: VALID_API_KEY });
    await expect(
      client.turnstile("site", "https://example.com", { proxy: "user:pass@host:8080" })
    ).rejects.toThrow(ValidationError);
    await client.close();
  });

  it("close resolves without error", async () => {
    installMockFetch();
    const client = new CaptchaAI({ apiKey: VALID_API_KEY });
    await expect(client.close()).resolves.toBeUndefined();
  });
});
