import { Config } from "./config.js";
import { CaptchaTypeEntry } from "./registry.js";
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
} from "../errors.js";
import * as validation from "../helpers/validation.js";
import * as image from "../helpers/image.js";
import * as paramsHelper from "../helpers/params.js";
import * as retry from "../helpers/retry.js";
import * as extract from "../helpers/extract.js";
import { UniformResponse } from "../transport/base.js";
import { SolveResult } from "./result.js";

const SUBMIT_FATAL: Record<string, () => Error> = {
  ERROR_WRONG_USER_KEY: () => new InvalidKeyError("Key must be 32 characters"),
  ERROR_KEY_DOES_NOT_EXIST: () => new InvalidKeyError("Key not found - check your dashboard"),
  ERROR_BAD_PARAMETERS: () => new ValidationError("Required parameters missing or malformed"),
  ERROR_PAGEURL: () => new ValidationError("pageurl is missing or invalid"),
  ERROR_GOOGLEKEY: () => new ValidationError("googlekey/sitekey is missing"),
  ERROR_WRONG_GOOGLEKEY: () => new ValidationError("googlekey is malformed"),
  ERROR_TOO_BIG_CAPTCHA_FILESIZE: () => new ValidationError("Image is too large"),
  ERROR_ZERO_CAPTCHA_FILESIZE: () => new ValidationError("Image is too small (under 100 bytes)"),
  ERROR_IMAGE_DIMENSIONS_TOO_LARGE: () => new ValidationError("Image dimensions are too large"),
  ERROR_WRONG_FILE_EXTENSION: () => new ValidationError("Unsupported image file extension"),
  ERROR_IMAGE_TYPE_NOT_SUPPORTED: () => new ValidationError("Unsupported image type"),
  ERROR_UPLOAD: () => new ValidationError("Bad image upload"),
  ERROR_BAD_TOKEN_OR_PAGEURL: () => new ValidationError("Wrong sitekey + pageurl pair"),
  ERROR_BAD_PROXY: () => new ProxyError("Proxy was marked bad"),
  IP_BANNED: () => new APIError("IP banned - too many bad auth attempts")
};

const SUBMIT_RETRYABLE: Record<string, () => Error> = {
  ERROR_SERVER_ERROR: () => new APIError("Transient server error"),
  ERROR_INTERNAL_SERVER_ERROR: () => new APIError("Internal server error"),
  ERROR_PROXY_CONNECTION_FAILED: () => new ProxyError("Proxy connection failed")
};

const POLL_FATAL: Record<string, () => Error> = {
  ERROR_CAPTCHA_UNSOLVABLE: () => new UnsolvableError("Captcha could not be solved"),
  ERROR_WRONG_USER_KEY: () => new InvalidKeyError("Key must be 32 characters"),
  ERROR_KEY_DOES_NOT_EXIST: () => new InvalidKeyError("Key not found - check your dashboard"),
  ERROR_WRONG_ID_FORMAT: () => new APIError("Task ID not numeric"),
  ERROR_WRONG_CAPTCHA_ID: () => new APIError("Task ID not found"),
  ERROR_EMPTY_ACTION: () => new APIError("Missing action parameter")
};

function endpoint(config: Config, path: "in.php" | "res.php"): string {
  return `${config.baseUrl.replace(/\/+$/, "")}/${path}`;
}

function readStatusRequest(body: Record<string, unknown>): { status: number; request: string } {
  return { status: Number(body.status ?? 0), request: String(body.request ?? "") };
}

function keyErrorFromRequest(request: string): Error | undefined {
  if (request === "ERROR_WRONG_USER_KEY") return new InvalidKeyError("Key must be 32 characters");
  if (request === "ERROR_KEY_DOES_NOT_EXIST") return new InvalidKeyError("Key not found - check your dashboard");
  return undefined;
}

function bodyOrThrow(resp: UniformResponse): Record<string, unknown> {
  if (resp.statusCode === 999) {
    const detail = [resp.transportErrorType, resp.transportErrorMessage].filter(Boolean).join(" ");
    throw new NetworkError(
      detail.length > 0 ? `Network disconnected while contacting CaptchaAI API: ${detail}` : "Network disconnected while contacting CaptchaAI API"
    );
  }

  if (!resp.body) {
    const raw = (resp.rawText ?? "").trim();
    const fromRaw = SUBMIT_FATAL[raw];
    if (fromRaw) throw fromRaw();
    throw new APIError(`Malformed API response (HTTP ${resp.statusCode})`);
  }
  return resp.body;
}

async function getThreadUsage(config: Config, request: RequestFn): Promise<{ threads: number; workingThreads: number }> {
  const resp = await request("POST", endpoint(config, "res.php"), {
    key: config.apiKey,
    action: "threadsinfo",
    json: "1"
  });
  const body = bodyOrThrow(resp);
  const { status, request: req } = readStatusRequest(body);
  if (status === 0) {
    const keyErr = keyErrorFromRequest(req);
    if (keyErr) throw keyErr;
  }
  const threads = Number(body.threads);
  const workingThreads = Number(body.working_threads);
  if (!Number.isFinite(threads) || !Number.isFinite(workingThreads)) {
    throw new APIError("threadsinfo response missing thread counts");
  }
  return { threads, workingThreads };
}

export type RequestFn = (
  method: "GET" | "POST",
  url: string,
  data: Record<string, string>
) => Promise<UniformResponse>;

async function diagnoseAccountWhenBusy(config: Config, request: RequestFn): Promise<boolean> {
  const counts = await getThreadUsage(config, request);
  if (counts.workingThreads >= counts.threads) {
    return config.autoRetry;
  }
  throw new NoThreadsError("Account expired or has no active plan");
}

export async function submitTask(
  config: Config,
  entry: CaptchaTypeEntry,
  inputParams: Record<string, unknown>,
  request: RequestFn
): Promise<string> {
  validation.validate(inputParams, entry);

  if (entry.requiresProxy && (!config.proxy || !config.proxyType)) {
    throw new ValidationError(`${entry.name}: proxy and proxyType are required for this captcha type`);
  }
  if (config.proxyType && !config.proxy) {
    throw new ValidationError("proxyType is set but proxy is missing");
  }

  const params = { ...inputParams };
  if (entry.hasImage) {
    await image.resolve(params);
  }

  const data = paramsHelper.normalise(params);
  data.key = config.apiKey;
  data.method = entry.apiMethod;
  data.json = "1";
  if (config.proxy) {
    data.proxy = config.proxy;
    data.proxytype = config.proxyType ?? "";
  }

  const url = endpoint(config, "in.php");
  const backoff = retry.exponential(config.submitBackoffBaseMs, config.jitterMaxMs);
  const busyBackoff = retry.threadBusyBackoff();
  let attempts = 0;
  let busyWaitedMs = 0;

  if (!config.autoRetry) {
    const counts = await getThreadUsage(config, request);
    if (counts.workingThreads >= counts.threads) {
      throw new ThreadLimitError("All account threads are busy");
    }
  }

  while (true) {
    const resp = await request(entry.submitHttpMethod, url, data);
    const body = bodyOrThrow(resp);
    const { status, request: req } = readStatusRequest(body);

    if (status === 1) {
      return req;
    }

    if (SUBMIT_FATAL[req]) throw SUBMIT_FATAL[req]();

    if (req === "ERROR_ZERO_BALANCE") {
      const shouldRetry = await diagnoseAccountWhenBusy(config, request);
      if (!shouldRetry) throw new ThreadLimitError("All account threads are busy");
      if (busyWaitedMs >= config.threadBusyTimeoutMs) {
        throw new ThreadLimitError("All account threads busy - retries exhausted");
      }
      const sleepMs = busyBackoff.next().value ?? 8000;
      await retry.sleep(sleepMs);
      busyWaitedMs += sleepMs;
      continue;
    }

    if (SUBMIT_RETRYABLE[req]) {
      if (!config.autoRetry) throw SUBMIT_RETRYABLE[req]();
      attempts += 1;
      if (attempts > config.maxRetries) {
        throw new APIError(`${SUBMIT_RETRYABLE[req]().message} - retries exhausted`);
      }
      await retry.sleep(backoff.next().value ?? config.submitBackoffBaseMs);
      continue;
    }

    throw new APIError(`Unexpected submit error: ${req || "empty response"}`);
  }
}

export async function pollUntilReady(
  config: Config,
  entry: CaptchaTypeEntry,
  taskId: string,
  request: RequestFn
): Promise<Record<string, unknown>> {
  await retry.sleep(retry.addJitter(entry.initialWaitMs, config.jitterMaxMs));
  const url = endpoint(config, "res.php");
  const data = { key: config.apiKey, action: "get", id: taskId, json: "1" };
  let waitedMs = 0;

  while (true) {
    const resp = await request("GET", url, data);
    const body = bodyOrThrow(resp);
    const { status, request: req } = readStatusRequest(body);

    if (status === 1) return body;

    if (req === "CAPCHA_NOT_READY") {
      if (waitedMs >= config.maxPollMs) {
        throw new TimeoutError("Poll deadline exceeded before a result was ready");
      }
      await retry.sleep(retry.addJitter(entry.pollIntervalMs, config.jitterMaxMs));
      waitedMs += entry.pollIntervalMs;
      continue;
    }

    if (POLL_FATAL[req]) throw POLL_FATAL[req]();

    if (req === "ERROR_PROXY_CONNECTION_FAILED") {
      if (!config.autoRetry) throw new ProxyError("Proxy connection failed");
      if (waitedMs >= config.maxPollMs) throw new ProxyError("Proxy connection failed - retries exhausted");
      await retry.sleep(retry.addJitter(entry.pollIntervalMs, config.jitterMaxMs));
      waitedMs += entry.pollIntervalMs;
      continue;
    }

    throw new APIError(`Unexpected poll error: ${req || "empty response"}`);
  }
}

export async function fetchResult(
  config: Config,
  entry: CaptchaTypeEntry,
  taskId: string,
  request: RequestFn
): Promise<SolveResult> {
  const response = await pollUntilReady(config, entry, taskId, request);
  return extract.buildResult(response, entry, taskId);
}

export async function solveCaptcha(
  config: Config,
  entry: CaptchaTypeEntry,
  params: Record<string, unknown>,
  request: RequestFn
): Promise<SolveResult> {
  const taskId = await submitTask(config, entry, params, request);
  const response = await pollUntilReady(config, entry, taskId, request);
  return extract.buildResult(response, entry, taskId);
}

export async function threadsInfo(
  config: Config,
  request: RequestFn
): Promise<{ threads: number; workingThreads: number }> {
  return getThreadUsage(config, request);
}
