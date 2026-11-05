# CaptchaAI TypeScript & Node.js SDK

<p align="left">
  <a href="https://www.npmjs.com/package/captchaai-javascript"><img src="https://img.shields.io/npm/v/captchaai-javascript?label=npm&logo=npm" alt="npm" /></a>
  <a href="https://github.com/CaptchaAI/captchaai-javascript/releases"><img src="https://img.shields.io/github/v/release/CaptchaAI/captchaai-javascript?label=Release" alt="GitHub Release" /></a>
  <a href="https://docs.captchaai.com/"><img src="https://img.shields.io/badge/Docs-docs.captchaai.com-blue" alt="Documentation" /></a>
  <a href="https://chromewebstore.google.com/detail/fnnmnnfpdnlkccecmiicejhimhkbolhk?utm_source=item-share-cb"><img src="https://img.shields.io/chrome-web-store/v/fnnmnnfpdnlkccecmiicejhimhkbolhk?label=Chrome%20Extension&logo=googlechrome" alt="Chrome Extension" /></a>
  <a href="https://github.com/CaptchaAI/captchaai-javascript/blob/main/LICENSE"><img src="https://img.shields.io/badge/License-MIT-green.svg" alt="License" /></a>
</p>

CaptchaAI Node.js & TypeScript SDK — an official CAPTCHA solver and solving API client for reCAPTCHA v2/v3/Enterprise, Cloudflare Turnstile, Cloudflare Challenge, GeeTest v3, and image CAPTCHAs.

Call one method per captcha type; the SDK handles HTTP, polling, retries, and typed error mapping with zero external runtime dependencies.

For full copy-paste examples of every captcha type and feature, see [EXAMPLES.md](https://github.com/CaptchaAI/captchaai-javascript/blob/main/EXAMPLES.md).

---

## Table of Contents

- [Examples](https://github.com/CaptchaAI/captchaai-javascript/blob/main/EXAMPLES.md)
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
- [GeeTest v3](#geetest-v3)
- [CaptchaFox (beta)](#captchafox-beta)
- [Friendly Captcha (beta)](#friendly-captcha-beta)
- [Lemin (beta)](#lemin-beta)
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

Node.js **>= 18** (uses native `fetch` and `AbortSignal.timeout`). Zero external runtime dependencies.

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

Create a client with your API key from [CaptchaAI](https://captchaai.com/). The constructor validates the key and starts a background `threadsInfo` call to read your account thread cap.

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
  { gridSize: "3x3" }
);
console.log(result.solution);
```

---

## BLS captcha

Solve a BLS multi-image captcha. Pass exactly 9 images (path, URL, base64, or `Uint8Array` each). `solution` is a list of cell indices.

```ts
const images = Array.from({ length: 9 }, (_, i) => `img${i}.png`);
const result = await solver.bls(images, "YOUR_INSTRUCTIONS");
console.log(result.solution);
```

---

## reCAPTCHA v2

Solve reCAPTCHA v2 (standard, invisible, or enterprise).

```ts
// Standard
const result = await solver.recaptchaV2(
  "YOUR_SITEKEY",
  "https://example.com"
);
console.log(result.solution);

// Invisible
const invisibleResult = await solver.recaptchaV2(
  "YOUR_SITEKEY",
  "https://example.com",
  { invisible: true }
);

// Enterprise
const enterpriseResult = await solver.recaptchaV2(
  "YOUR_SITEKEY",
  "https://example.com",
  { enterprise: true, action: "login" }
);
console.log(enterpriseResult.solution);
console.log(enterpriseResult.userAgent);
```

---

## reCAPTCHA v3

Solve reCAPTCHA v3. `minScore` defaults to `0.3`.

```ts
// Standard
const result = await solver.recaptchaV3(
  "YOUR_SITEKEY",
  "https://example.com",
  "verify",
  0.7
);
console.log(result.solution);

// Enterprise
const entResult = await solver.recaptchaV3(
  "YOUR_SITEKEY",
  "https://example.com",
  "login",
  0.9,
  { enterprise: true }
);
```

---

## Cloudflare Turnstile

Solve Cloudflare Turnstile.

```ts
const result = await solver.turnstile(
  "0x4AAAAAAAB...",
  "https://example.com",
  { action: "login" }
);
console.log(result.solution);
```

---

## Cloudflare Challenge

Solve Cloudflare Challenge (5s / Managed / Non-Interactive). **A working proxy is mandatory.**

```ts
const result = await solver.cloudflareChallenge(
  "https://example.com",
  "<html>...</html>",                 // full page HTML
  "user:pass@host:port",             // required
  "HTTP",                            // required
  "Mozilla/5.0 ..."                  // must match the session that fetched the HTML
);
console.log(result.solution);         // clearance token
```

---

## GeeTest v3

Solve GeeTest v3. Requires `gt`, `challenge`, and `url`.

```ts
const result = await solver.geetestV3(
  "YOUR_GT",
  "YOUR_CHALLENGE",
  "https://example.com"
);
console.log(result.solution);
// { geetest_challenge, geetest_validate, geetest_seccode }
```

---

## CaptchaFox (beta)

Solve CaptchaFox. **A working proxy is mandatory.**

```ts
const result = await solver.captchafox(
  "YOUR_SITEKEY",
  "https://example.com",
  "user:pass@host:port",
  "HTTP"
);
console.log(result.solution);
```

---

## Friendly Captcha (beta)

Solve Friendly Captcha (v1 or v2). No proxy is required.

```ts
const result = await solver.friendlyCaptcha(
  "YOUR_SITEKEY",
  "https://example.com",
  { version: "v1" }
);
console.log(result.solution);
```

---

## Lemin (beta)

Solve Lemin puzzle.

```ts
const result = await solver.lemin(
  "YOUR_CAPTCHA_ID",
  "lemin-cropped-captcha",
  "https://example.com"
);
console.log(result.solution);
// { answer, challenge_uuid }
```

---

## Other methods

### Thread usage

CaptchaAI is thread-based. Check current usage:

```ts
const info = await solver.threadsInfo();
// { threads: 10, working_threads: 3 }
```

### Manual submit / fetch

Submit now and poll later:

```ts
const taskId = await solver.send("recaptcha_v2", {
  googlekey: "YOUR_SITEKEY",
  pageurl: "https://example.com",
});

const result = await solver.getResult("recaptcha_v2", taskId);
console.log(result.solution);
```

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
    // all account threads busy
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

---

## Resources & Links

- 🌐 [Official Website](https://captchaai.com/)
- 📘 [API Documentation](https://docs.captchaai.com/)
- 📦 [npm Package](https://www.npmjs.com/package/captchaai-javascript)
- 🧩 [Chrome Extension](https://chromewebstore.google.com/detail/fnnmnnfpdnlkccecmiicejhimhkbolhk?utm_source=item-share-cb)

---

## License

This project is licensed under the [MIT License](LICENSE).

Copyright (c) 2026 Dev@Captchaai
