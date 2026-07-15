# CaptchaAI TypeScript SDK

Node.js TypeScript client for the [CaptchaAI](https://captchaai.com) captcha-solving API.

Call one method per captcha type; the SDK handles HTTP, polling, retries, and error mapping.

---

## Table of Contents

- [Installation](#installation)
- [Requirements](#requirements)
- [Quick start](#quick-start)
- [Configuration](#configuration)
- [Solve result](#solve-result)
- [Normal captcha](#normal-captcha)
- [Grid captcha](#grid-captcha)
- [BLS captcha](#bls-captcha)
- [reCAPTCHA v2](#recaptcha-v2)
- [reCAPTCHA v3](#recaptcha-v3)
- [Cloudflare Turnstile](#cloudflare-turnstile)
- [Cloudflare Challenge](#cloudflare-challenge)
- [GeeTest](#geetest)
- [CaptchaFox](#captchafox)
- [Friendly Captcha](#friendly-captcha)
- [Lemin](#lemin)
- [Other methods](#other-methods)
- [Error handling](#error-handling)
- [AsyncCaptchaAI](#asynccaptchaai)
- [Proxies](#proxies)
- [License](#license)

---

## Installation

```bash
npm install captchaai-javascript
```

## Requirements

Node.js **>= 18** (uses native `fetch` and `AbortSignal.timeout`).

## Quick start

```ts
import { CaptchaAI } from "captchaai-javascript";

const solver = new CaptchaAI({ apiKey: "YOUR_32_CHAR_API_KEY" });

const result = await solver.recaptchaV2(
  "YOUR_SITEKEY",
  "https://example.com"
);

console.log(result.solution);
await solver.close();
```

## Configuration

Create a client with your API key. The constructor validates the key and starts a background `threadsInfo` call to read your account thread cap.

```ts
import { CaptchaAI } from "captchaai-javascript";

const solver = new CaptchaAI({
  apiKey: "YOUR_32_CHAR_API_KEY",
  proxy: "user:pass@host:port",       // optional
  proxyType: "HTTP",                  // required when proxy is set
  autoRetry: true,
  baseUrl: "https://ocr.captchaai.com",
  threadBusyTimeoutSeconds: 120,
  maxRetries: 5,                      // optional; overrides autoRetry when set
  networkTimeoutSeconds: 30,
  maxPollSeconds: 180,
  jitterMaxSeconds: 1,
  submitBackoffBaseSeconds: 5,
});
```

| Option | Default | Description |
|--------|---------|-------------|
| `apiKey` | *(required)* | 32-character CaptchaAI API key |
| `proxy` | `undefined` | `"user:pass@host:port"` applied to every solve |
| `proxyType` | `undefined` | `HTTP` / `HTTPS` / `SOCKS4` / `SOCKS5` — required when `proxy` is set |
| `autoRetry` | `true` | `true` = SDK retries transient errors with backoff; `false` = raise immediately |
| `baseUrl` | `https://ocr.captchaai.com` | API host for `in.php` / `res.php` |
| `threadBusyTimeoutSeconds` | `120` | Seconds to keep retrying while all account threads are busy |
| `maxRetries` | `5` (implicit) | When explicitly set: `0` disables retries; `N > 0` enables up to N submit attempts (supersedes `autoRetry`) |
| `networkTimeoutSeconds` | `30` | Per-request HTTP timeout |
| `maxPollSeconds` | `180` | Poll deadline before `TimeoutError` |
| `jitterMaxSeconds` | `1` | Random jitter added to wait intervals |
| `submitBackoffBaseSeconds` | `5` | Base interval for exponential submit backoff |

A bad key raises `InvalidKeyError` before any solve runs. Call `solver.close()` when finished.

---

## Solve result

Every solve method returns a `SolveResult`:

```ts
result.taskId     // string — task ID from submit (always present)
result.solution   // string | string[] | Record<string, unknown> — token, cell indices, or structured answer
result.userAgent  // string | undefined — set for Enterprise / Cloudflare Challenge / CaptchaFox
result.raw        // Record<string, unknown> | undefined — full API response (debugging)
result.rawText    // string | undefined — unparsed solution string before JSON parsing

result.toString() // token string for common token types
```

Reuse `result.userAgent` on the target site when it is present (Enterprise reCAPTCHA, Cloudflare Challenge, CaptchaFox).

---

## Normal captcha

Solve a text/image captcha. `image` may be a file path, URL, data-URI, raw base64, or `Uint8Array`.

```ts
import { CaptchaAI } from "captchaai-javascript";

const solver = new CaptchaAI({ apiKey: "YOUR_32_CHAR_API_KEY" });

const result = await solver.normal("captcha.png", {
  numeric: 1,              // 0=any, 1=digits, 2=letters, 3=digits+letters, 4=no digits
  minLen: 4,
  maxLen: 6,
  phrase: 0,                 // 0=single word, 1=multi-word
  caseSensitive: 0,          // 0=insensitive, 1=case-sensitive
  lang: "en",
  instructions: "Type the characters you see",
});

console.log(result.solution);
await solver.close();
```

---

## Grid captcha

Solve a tile-selection captcha. `gridSize` must be `"3x3"` or `"4x4"`. `solution` is a list of cell indices.

```ts
const result = await solver.grid(
  "grid.png",
  "select all traffic lights",
  "3x3"
);

console.log(result.solution);
```

---

## BLS captcha

Solve a BLS multi-image captcha. Pass exactly **9** images (path/URL/base64/`Uint8Array` each). `solution` is a list of cell indices.

```ts
const result = await solver.bls(
  Array.from({ length: 9 }, (_, i) => `img${i}.png`),
  "YOUR_INSTRUCTIONS"
);

console.log(result.solution);
```

---

## reCAPTCHA v2

Solve reCAPTCHA v2 (standard, invisible, or enterprise). Pass `sitekey` and page `url`. Enterprise results include `userAgent`.

If both `enterprise` and `invisible` are set, `enterprise` takes precedence.

```ts
// Standard
const result = await solver.recaptchaV2(
  "YOUR_SITEKEY",
  "https://example.com"
);
console.log(result.solution);

// Invisible
await solver.recaptchaV2("YOUR_SITEKEY", "https://example.com", {
  invisible: true,
});

// Enterprise (optional action; result may include userAgent)
const enterprise = await solver.recaptchaV2("YOUR_SITEKEY", "https://example.com", {
  enterprise: true,
  action: "login",
});
console.log(enterprise.solution, enterprise.userAgent);
```

Optional per-call options: `cookies`, `userAgent`, `proxy`, `proxyType`.

---

## reCAPTCHA v3

Solve reCAPTCHA v3 (standard or enterprise). `action` is required — the SDK validates it before submit.

```ts
const result = await solver.recaptchaV3("YOUR_SITEKEY", "https://example.com", {
  action: "login",
  minScore: 0.3,
});
console.log(result.solution);

// Enterprise
const enterprise = await solver.recaptchaV3("YOUR_SITEKEY", "https://example.com", {
  action: "login",
  enterprise: true,
});
console.log(enterprise.solution, enterprise.userAgent);
```

Optional per-call options: `cookies`, `userAgent`, `proxy`, `proxyType`.

---

## Cloudflare Turnstile

Solve a Cloudflare Turnstile widget.

```ts
const result = await solver.turnstile(
  "YOUR_SITEKEY",
  "https://example.com"
);

console.log(result.solution);
```

Optional per-call options: `cookies`, `userAgent`, `proxy`, `proxyType`.

---

## Cloudflare Challenge

Solve a Cloudflare interstitial challenge page. A **proxy is mandatory** (client-level or per-call). The result includes `userAgent` to reuse on the target site.

```ts
const solver = new CaptchaAI({
  apiKey: "YOUR_32_CHAR_API_KEY",
  proxy: "user:pass@host:port",
  proxyType: "HTTP",
});

const result = await solver.cloudflareChallenge("https://example.com");
console.log(result.solution, result.userAgent);
```

Optional per-call options: `cookies`, `userAgent`, `proxy`, `proxyType`.

---

## GeeTest

Solve GeeTest v3. `solution` is an object with `challenge`, `validate`, and `seccode`.

```ts
const result = await solver.geetest(
  "YOUR_GT",
  "YOUR_CHALLENGE",
  "https://example.com"
);

console.log(result.solution);
```

Optional per-call options: `cookies`, `userAgent`, `proxy`, `proxyType`.

---

## CaptchaFox

Solve a CaptchaFox slider challenge. A **proxy is mandatory**. Reuse `result.userAgent` when submitting the token.

```ts
const solver = new CaptchaAI({
  apiKey: "YOUR_32_CHAR_API_KEY",
  proxy: "user:pass@host:port",
  proxyType: "HTTP",
});

const result = await solver.captchafox(
  "YOUR_SITEKEY",
  "https://example.com"
);

console.log(result.solution, result.userAgent);
```

Optional per-call options: `cookies`, `userAgent`, `proxy`, `proxyType`.

---

## Friendly Captcha

Solve a Friendly Captcha proof-of-work challenge. No proxy is required.

```ts
const result = await solver.friendlyCaptcha(
  "YOUR_SITEKEY",
  "https://example.com",
  { version: "v1" }   // optional: "v1" or "v2"
);

console.log(result.solution);
```

Optional per-call options: `proxy`, `proxyType`.

---

## Lemin

Solve a Lemin puzzle. `solution` is an object with `answer` and `challenge_uuid`.

```ts
const result = await solver.lemin(
  "YOUR_CAPTCHA_ID",
  "lemin-cropped-captcha",
  "https://example.com",
  { apiServer: "api.leminnow.com" }   // optional
);

console.log(result.solution);
```

Optional per-call options: `proxy`, `proxyType`.

---

## Other methods

### Thread usage

CaptchaAI is thread-based. Check current usage:

```ts
const info = await solver.threadsInfo();
// { threads: 10, workingThreads: 3 }
```

### Manual submit / fetch

Submit now and poll later. The first argument is a registry type name (snake_case). Params use API field names (`googlekey`, `pageurl`, etc.):

```ts
const taskId = await solver.send("recaptcha_v2", {
  googlekey: "YOUR_SITEKEY",
  pageurl: "https://example.com",
});

const result = await solver.getResult("recaptcha_v2", taskId);
console.log(result.solution);
```

Registry type names: `normal`, `grid`, `bls`, `recaptcha_v2`, `recaptcha_v2_invisible`, `recaptcha_v2_enterprise`, `recaptcha_v3`, `recaptcha_v3_enterprise`, `turnstile`, `cloudflare_challenge`, `geetest`, `captchafox`, `friendly_captcha`, `lemin`.

### Close

```ts
await solver.close();
```

---

## Error handling

All SDK errors inherit from `CaptchaAIError`:

```ts
import {
  CaptchaAI,
  CaptchaAIError,
  InvalidKeyError,
  ValidationError,
  ProxyError,
  ThreadLimitError,
  NoThreadsError,
  UnsolvableError,
  APIError,
  NetworkError,
  TimeoutError,
} from "captchaai-javascript";

const solver = new CaptchaAI({ apiKey: "YOUR_32_CHAR_API_KEY" });

try {
  const result = await solver.recaptchaV2(
    "YOUR_SITEKEY",
    "https://example.com"
  );
  console.log(result.solution);
} catch (error) {
  if (error instanceof InvalidKeyError) {
    // wrong-length key, or API rejected the key
  } else if (error instanceof ValidationError) {
    // missing/invalid params, bad image input, missing required proxy, etc.
  } else if (error instanceof ProxyError) {
    // bad proxy or proxy connection failed
  } else if (error instanceof ThreadLimitError) {
    // all account threads busy (and retries skipped or exhausted)
  } else if (error instanceof NoThreadsError) {
    // account expired or has no active plan
  } else if (error instanceof UnsolvableError) {
    // service could not solve the captcha
  } else if (error instanceof NetworkError) {
    // could not reach the API
  } else if (error instanceof TimeoutError) {
    // poll deadline exceeded before a result was ready
  } else if (error instanceof APIError) {
    // unexpected / malformed API response
  } else if (error instanceof CaptchaAIError) {
    // any other SDK error
  }
}
```

| Error | Typical cause |
|-------|---------------|
| `InvalidKeyError` | Key not 32 characters, or API rejected the key |
| `ValidationError` | Missing/invalid params, bad image, unknown captcha type, proxy required but missing |
| `ProxyError` | Bad proxy or proxy connection failed |
| `ThreadLimitError` | All account threads busy; local in-flight cap reached when `autoRetry` is `false` |
| `NoThreadsError` | Account expired or has no active plan |
| `UnsolvableError` | Service could not solve the captcha |
| `NetworkError` | HTTP transport failure contacting the API |
| `TimeoutError` | Poll deadline exceeded before a result was ready |
| `APIError` | Unexpected or malformed API response |

### Retry behaviour

| Setting | Behaviour |
|---------|-----------|
| `autoRetry: true` (default) | Retry transient submit/proxy errors with exponential backoff |
| `autoRetry: false` | Raise immediately on transient errors; also fast-fails when the local in-flight count hits the thread cap |
| `maxRetries: N` (`N > 0`) | Like `autoRetry: true`, capped at N submit attempts |
| `maxRetries: 0` | Like `autoRetry: false` |

`maxRetries` supersedes `autoRetry` when both are provided. Fatal errors (`InvalidKeyError`, `ValidationError`, `UnsolvableError`, `NoThreadsError`, and similar) always raise immediately.

---

## AsyncCaptchaAI

All solve methods on `CaptchaAI` already return Promises. `AsyncCaptchaAI` is an alternative entry point that awaits initialization (key validation + `threadsInfo`) before the client is returned.

Create it with `await AsyncCaptchaAI.create(...)` — not `new AsyncCaptchaAI(...)`:

```ts
import { AsyncCaptchaAI } from "captchaai-javascript";

const solver = await AsyncCaptchaAI.create({ apiKey: "YOUR_32_CHAR_API_KEY" });

const result = await solver.turnstile(
  "YOUR_SITEKEY",
  "https://example.com"
);

console.log(result.solution);
await solver.aclose();
```

`AsyncCaptchaAI` mirrors the same methods as `CaptchaAI` (`normal`, `recaptchaV2`, `send`, `getResult`, `threadsInfo`, etc.) and uses `aclose()` instead of `close()`.

> Note: Unlike the Python SDK, this package does not provide an async context manager.

---

## Proxies

Proxies are supported at client level and per call. Format: `"user:pass@host:port"`. `proxyType` is required whenever a proxy is set (`HTTP`, `HTTPS`, `SOCKS4`, or `SOCKS5`).

```ts
// Client-level (every solve)
const solver = new CaptchaAI({
  apiKey: "YOUR_32_CHAR_API_KEY",
  proxy: "user:pass@host:port",
  proxyType: "HTTP",
});

// Per-call override (does not mutate client config)
const result = await solver.recaptchaV2(
  "YOUR_SITEKEY",
  "https://example.com",
  {
    proxy: "user:pass@other-host:port",
    proxyType: "SOCKS5",
  }
);
```

**Proxy is mandatory** for:

- `cloudflareChallenge`
- `captchafox`

---

## License

This project is licensed under the [MIT License](LICENSE).

Copyright (c) 2026 Dev@Captchaai
