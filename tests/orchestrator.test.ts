import { describe, expect, it, vi } from "vitest";
import { buildConfig } from "../src/core/config.js";
import { getEntry } from "../src/core/registry.js";
import {
  fetchResult,
  pollUntilReady,
  solveCaptcha,
  submitTask,
  threadsInfo,
  type RequestFn
} from "../src/core/orchestrator.js";
import {
  APIError,
  InvalidKeyError,
  NetworkError,
  NoThreadsError,
  ProxyError,
  ThreadLimitError,
  TimeoutError,
  UnsolvableError,
  ValidationError
} from "../src/errors.js";
import { UniformResponse } from "../src/transport/base.js";
import { VALID_API_KEY } from "./helpers/fixtures.js";
import { advanceTimers, useFakeTimers } from "./helpers/timers.js";

function jsonBody(payload: Record<string, unknown>): UniformResponse {
  return {
    statusCode: 200,
    body: payload,
    rawText: JSON.stringify(payload),
    transportErrorType: undefined,
    transportErrorMessage: undefined
  };
}

function requestSequence(responses: UniformResponse[]): RequestFn {
  let index = 0;
  return vi.fn(async () => {
    const response = responses[index];
    index += 1;
    if (!response) {
      throw new Error(`Unexpected request #${index}`);
    }
    return response;
  });
}

describe("orchestrator", () => {
  const config = buildConfig(VALID_API_KEY, {
    jitterMaxSeconds: 0,
    maxPollSeconds: 2,
    submitBackoffBaseSeconds: 1,
    threadBusyTimeoutSeconds: 1
  });

  it("threadsInfo returns thread counts", async () => {
    const request = requestSequence([
      jsonBody({ status: 1, threads: 5, working_threads: 2 })
    ]);
    await expect(threadsInfo(config, request)).resolves.toEqual({
      threads: 5,
      workingThreads: 2
    });
  });

  it("threadsInfo throws APIError when counts are missing", async () => {
    const request = requestSequence([jsonBody({ status: 1, threads: "x", working_threads: 2 })]);
    await expect(threadsInfo(config, request)).rejects.toThrow(
      /threadsinfo response missing thread counts/
    );
  });

  it("threadsInfo maps invalid key responses", async () => {
    const request = requestSequence([jsonBody({ status: 0, request: "ERROR_WRONG_USER_KEY" })]);
    await expect(threadsInfo(config, request)).rejects.toThrow(InvalidKeyError);
  });

  it("submitTask returns a task id on success", async () => {
    const entry = getEntry("turnstile");
    const request = requestSequence([jsonBody({ status: 1, request: "999001" })]);
    await expect(
      submitTask(
        config,
        entry,
        { sitekey: "site", pageurl: "https://example.com" },
        request
      )
    ).resolves.toBe("999001");
  });

  it("submitTask throws ValidationError when proxy is required but missing", async () => {
    const entry = getEntry("cloudflare_challenge");
    const request = requestSequence([]);
    await expect(
      submitTask(config, entry, { pageurl: "https://example.com" }, request)
    ).rejects.toThrow(ValidationError);
    await expect(
      submitTask(config, entry, { pageurl: "https://example.com" }, request)
    ).rejects.toThrow(/proxy and proxyType are required/);
  });

  it("submitTask maps fatal API codes to typed errors", async () => {
    const cases: Array<[string, new (...args: never[]) => Error]> = [
      ["ERROR_WRONG_USER_KEY", InvalidKeyError],
      ["ERROR_BAD_PARAMETERS", ValidationError],
      ["ERROR_BAD_PROXY", ProxyError],
      ["IP_BANNED", APIError]
    ];

    for (const [code, ErrorClass] of cases) {
      const entry = getEntry("turnstile");
      const request = requestSequence([jsonBody({ status: 0, request: code })]);
      await expect(
        submitTask(
          config,
          entry,
          { sitekey: "site", pageurl: "https://example.com" },
          request
        )
      ).rejects.toThrow(ErrorClass);
    }
  });

  it("submitTask throws ThreadLimitError when all threads are busy and autoRetry is false", async () => {
    const noRetryConfig = buildConfig(VALID_API_KEY, { autoRetry: false, maxRetries: 0 });
    const entry = getEntry("turnstile");
    const request = requestSequence([jsonBody({ status: 1, threads: 1, working_threads: 1 })]);
    await expect(
      submitTask(
        noRetryConfig,
        entry,
        { sitekey: "site", pageurl: "https://example.com" },
        request
      )
    ).rejects.toThrow(ThreadLimitError);
  });

  it("submitTask throws NoThreadsError on zero balance with spare capacity", async () => {
    const request = requestSequence([
      jsonBody({ status: 0, request: "ERROR_ZERO_BALANCE" }),
      jsonBody({ status: 1, threads: 5, working_threads: 1 })
    ]);
    await expect(
      submitTask(
        config,
        getEntry("turnstile"),
        { sitekey: "site", pageurl: "https://example.com" },
        request
      )
    ).rejects.toThrow(NoThreadsError);
  });

  it("pollUntilReady returns the completed response body", async () => {
    useFakeTimers();
    const entry = getEntry("turnstile");
    const request = requestSequence([
      jsonBody({ status: 1, request: "done" })
    ]);
    const promise = pollUntilReady(config, entry, "1", request);
    await advanceTimers(20_000);
    await expect(promise).resolves.toEqual({ status: 1, request: "done" });
  });

  it("pollUntilReady throws TimeoutError when polling exceeds maxPollMs", async () => {
    useFakeTimers();
    const entry = getEntry("turnstile");
    const request = vi.fn(async () => jsonBody({ status: 0, request: "CAPCHA_NOT_READY" }));
    const promise = pollUntilReady(config, entry, "1", request);
    const expectation = expect(promise).rejects.toThrow(TimeoutError);
    await vi.runAllTimersAsync();
    await expectation;
  });

  it("pollUntilReady maps unsolvable responses", async () => {
    useFakeTimers();
    const entry = getEntry("turnstile");
    const request = requestSequence([
      jsonBody({ status: 0, request: "ERROR_CAPTCHA_UNSOLVABLE" })
    ]);
    const promise = pollUntilReady(config, entry, "1", request);
    const expectation = expect(promise).rejects.toThrow(UnsolvableError);
    await advanceTimers(20_000);
    await expectation;
  });

  it("pollUntilReady throws ProxyError when autoRetry is false", async () => {
    useFakeTimers();
    const noRetryConfig = buildConfig(VALID_API_KEY, { autoRetry: false, maxRetries: 0 });
    const entry = getEntry("turnstile");
    const request = requestSequence([
      jsonBody({ status: 0, request: "ERROR_PROXY_CONNECTION_FAILED" })
    ]);
    const promise = pollUntilReady(noRetryConfig, entry, "1", request);
    const expectation = expect(promise).rejects.toThrow(ProxyError);
    await advanceTimers(20_000);
    await expectation;
  });

  it("solveCaptcha submits and polls to build a SolveResult", async () => {
    useFakeTimers();
    const entry = getEntry("turnstile");
    const request = requestSequence([
      jsonBody({ status: 1, request: "task-1" }),
      jsonBody({ status: 0, request: "CAPCHA_NOT_READY" }),
      jsonBody({ status: 1, request: "final-token" })
    ]);
    const promise = solveCaptcha(
      config,
      entry,
      { sitekey: "site", pageurl: "https://example.com" },
      request
    );
    await advanceTimers(30_000);
    const result = await promise;
    expect(result.taskId).toBe("task-1");
    expect(result.solution).toBe("final-token");
  });

  it("fetchResult builds a SolveResult from poll output", async () => {
    useFakeTimers();
    const entry = getEntry("geetest");
    const request = requestSequence([
      jsonBody({ status: 1, request: '{"validate":"ok"}' })
    ]);
    const promise = fetchResult(config, entry, "55", request);
    await advanceTimers(20_000);
    const result = await promise;
    expect(result.solution).toEqual({ validate: "ok" });
  });

  it("bodyOrThrow maps transport failures to NetworkError", async () => {
    const request = requestSequence([
      {
        statusCode: 999,
        body: undefined,
        rawText: undefined,
        transportErrorType: "AbortError",
        transportErrorMessage: "timed out"
      }
    ]);
    await expect(threadsInfo(config, request)).rejects.toThrow(NetworkError);
  });
});
