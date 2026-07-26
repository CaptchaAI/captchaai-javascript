# CaptchaAI SDK Examples

Copy-paste cookbook for every captcha type and SDK feature. For API reference and option tables, see [README.md](README.md).

---

## Table of Content

- [Prerequisites](#prerequisites)
- [CaptchaAI client setup](#captchaai-client-setup)
- [AsyncCaptchaAI client setup](#asynccaptchaai-client-setup)
- [Solve result](#solve-result)
- [CaptchaAI examples](#captchaai-examples)
  - [Normal captcha](#captchaai-normal-captcha)
  - [Grid captcha](#captchaai-grid-captcha)
  - [BLS captcha](#captchaai-bls-captcha)
  - [reCAPTCHA v2](#captchaai-recaptcha-v2)
  - [reCAPTCHA v3](#captchaai-recaptcha-v3)
  - [Cloudflare Turnstile](#captchaai-cloudflare-turnstile)
  - [Cloudflare Challenge](#captchaai-cloudflare-challenge)
  - [GeeTest](#captchaai-geetest)
  - [CaptchaFox](#captchaai-captchafox)
  - [Friendly Captcha](#captchaai-friendly-captcha)
  - [Lemin](#captchaai-lemin)
- [AsyncCaptchaAI examples](#asynccaptchaai-examples)
  - [Normal captcha](#async-normal-captcha)
  - [Grid captcha](#async-grid-captcha)
  - [BLS captcha](#async-bls-captcha)
  - [reCAPTCHA v2](#async-recaptcha-v2)
  - [reCAPTCHA v3](#async-recaptcha-v3)
  - [Cloudflare Turnstile](#async-cloudflare-turnstile)
  - [Cloudflare Challenge](#async-cloudflare-challenge)
  - [GeeTest](#async-geetest)
  - [CaptchaFox](#async-captchafox)
  - [Friendly Captcha](#async-friendly-captcha)
  - [Lemin](#async-lemin)
- [Functionality examples](#functionality-examples)
  - [Thread usage](#thread-usage)
  - [Manual submit and fetch](#manual-submit-and-fetch)
  - [Error handling](#error-handling)
  - [Proxies](#proxies)
  - [Retry behaviour](#retry-behaviour)
  - [Resource cleanup](#resource-cleanup)
  - [Mandatory-proxy types](#mandatory-proxy-types)
- [Placeholder reference](#placeholder-reference)

---

## Prerequisites

```bash
npm install captchaai-javascript
```

Requires **Node.js >= 18**. Set your API key as an environment variable before running any example:

```bash
export CAPTCHAAI_API_KEY="your_32_character_api_key_here"
```

PowerShell:

```powershell
$env:CAPTCHAAI_API_KEY = "your_32_character_api_key_here"
```

---

## CaptchaAI client setup

All solve methods return Promises — use `await` (or `.then()`). There is no blocking/sync I/O in this SDK.

```ts
import { CaptchaAI } from "captchaai-javascript";

const solver = new CaptchaAI({
  apiKey: process.env.CAPTCHAAI_API_KEY!,
  proxy: "user:pass@host:port",       // optional
  proxyType: "HTTP",                  // required when proxy is set
  autoRetry: true,                    // retry transient errors with backoff
  baseUrl: "https://ocr.captchaai.com",
  threadBusyTimeoutSeconds: 120,      // seconds to wait when all threads are busy
  maxRetries: 5,                      // optional; 0 disables, N > 0 caps attempts
  networkTimeoutSeconds: 30,
  maxPollSeconds: 180,
  jitterMaxSeconds: 1,
  submitBackoffBaseSeconds: 5,
});

// The constructor validates the key and starts a background threadsInfo call.
// Call await solver.close() when finished.
```

---

## AsyncCaptchaAI client setup

`AsyncCaptchaAI` mirrors the same solve API but awaits initialization (key validation + `threadsInfo`) before the client is returned.

```ts
import { AsyncCaptchaAI } from "captchaai-javascript";

async function main() {
  // Must use create() — direct new AsyncCaptchaAI(...) is not allowed.
  const solver = await AsyncCaptchaAI.create({
    apiKey: process.env.CAPTCHAAI_API_KEY!,
    proxy: "user:pass@host:port",       // optional
    proxyType: "HTTP",                  // required when proxy is set
    autoRetry: true,
    baseUrl: "https://ocr.captchaai.com",
    threadBusyTimeoutSeconds: 120,
    maxRetries: 5,
  });

  // ... solve captchas ...

  await solver.aclose();
}

main();
```

> Note: Unlike the Python SDK, this package does not provide an async context manager.

---

## Solve result

Every solve method returns a `SolveResult`:

```ts
import { CaptchaAI } from "captchaai-javascript";

const solver = new CaptchaAI({ apiKey: process.env.CAPTCHAAI_API_KEY! });

const result = await solver.turnstile(
  "YOUR_SITEKEY",
  "https://example.com"
);

console.log(result.taskId);      // string — task ID from submit (always present)
console.log(result.solution);    // string | string[] | Record<string, unknown>
console.log(result.userAgent);   // string | undefined — solver browser UA (some types only)
console.log(result.raw);         // Record<string, unknown> | undefined — full API response
console.log(result.rawText);     // string | undefined — unparsed solution before JSON parsing
console.log(result.toString());  // token string for common token types

await solver.close();
```

**Solution shapes by type:**

| Type | `solution` shape | `userAgent` |
|------|------------------|-------------|
| normal, turnstile, friendly_captcha | `string` (token/text) | `undefined` |
| grid, bls | `string[]` (cell indices) | `undefined` |
| geetest, lemin | `Record<string, unknown>` | `undefined` |
| recaptcha v2/v3 enterprise, cloudflare_challenge, captchafox | `string` (token) | **required on target site** |

Reuse `result.userAgent` when submitting the token for Enterprise reCAPTCHA, Cloudflare Challenge, and CaptchaFox solves.

---

## CaptchaAI examples

### CaptchaAI: Normal captcha

Solve a text/image captcha. `image` accepts a file path, URL, data-URI, raw base64, or `Uint8Array`.

**Required:** `image`  
**Optional:** `numeric`, `minLen`, `maxLen`, `phrase`, `caseSensitive`, `lang`, `instructions`, `proxy`, `proxyType`

```ts
import { CaptchaAI } from "captchaai-javascript";

const solver = new CaptchaAI({ apiKey: process.env.CAPTCHAAI_API_KEY! });

// From file path
const result = await solver.normal("captcha.png", {
  numeric: 1,              // 0=any, 1=digits, 2=letters, 3=digits+letters, 4=no digits
  minLen: 4,
  maxLen: 6,
  phrase: 0,               // 0=single word, 1=multi-word
  caseSensitive: 0,        // 0=insensitive, 1=case-sensitive
  lang: "en",
  instructions: "Type the characters you see",
});
console.log(result.solution);  // string — recognised text

await solver.close();
```

From URL:

```ts
import { CaptchaAI } from "captchaai-javascript";

const solver = new CaptchaAI({ apiKey: process.env.CAPTCHAAI_API_KEY! });
const result = await solver.normal("https://example.com/captcha.png");
console.log(result.solution);
await solver.close();
```

From raw base64:

```ts
import { CaptchaAI } from "captchaai-javascript";

const solver = new CaptchaAI({ apiKey: process.env.CAPTCHAAI_API_KEY! });
const result = await solver.normal(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg=="
);
console.log(result.solution);
await solver.close();
```

From bytes:

```ts
import { readFile } from "node:fs/promises";
import { CaptchaAI } from "captchaai-javascript";

const solver = new CaptchaAI({ apiKey: process.env.CAPTCHAAI_API_KEY! });
const imageBytes = await readFile("captcha.png");
const result = await solver.normal(imageBytes);
console.log(result.solution);
await solver.close();
```

---

### CaptchaAI: Grid captcha

Solve a tile-selection captcha. `gridSize` must be `"3x3"` or `"4x4"`.

**Required:** `image`, `instructions`, `gridSize`  
**Optional:** `proxy`, `proxyType`

```ts
import { CaptchaAI } from "captchaai-javascript";

const solver = new CaptchaAI({ apiKey: process.env.CAPTCHAAI_API_KEY! });

const result = await solver.grid(
  "grid.png",
  "select all traffic lights",
  "3x3"
);
console.log(result.solution);  // string[] — cell indices to click, e.g. ["0", "3", "7"]

await solver.close();
```

4x4 grid:

```ts
import { CaptchaAI } from "captchaai-javascript";

const solver = new CaptchaAI({ apiKey: process.env.CAPTCHAAI_API_KEY! });
const result = await solver.grid(
  "grid_4x4.png",
  "select all crosswalks",
  "4x4"
);
console.log(result.solution);
await solver.close();
```

---

### CaptchaAI: BLS captcha

Solve a BLS multi-image captcha. Pass exactly **9** images.

**Required:** `images` (array of 9), `instructions`  
**Optional:** `proxy`, `proxyType`

```ts
import { CaptchaAI } from "captchaai-javascript";

const solver = new CaptchaAI({ apiKey: process.env.CAPTCHAAI_API_KEY! });

const result = await solver.bls(
  Array.from({ length: 9 }, (_, i) => `img${i}.png`),
  "YOUR_INSTRUCTIONS"
);
console.log(result.solution);  // string[] — cell indices

await solver.close();
```

---

### CaptchaAI: reCAPTCHA v2

Solve reCAPTCHA v2 (standard, invisible, or enterprise). If both `enterprise` and `invisible` are set, `enterprise` takes precedence.

**Required:** `sitekey`, `url`  
**Optional:** `invisible`, `enterprise`, `action`, `cookies`, `userAgent`, `proxy`, `proxyType`

Standard:

```ts
import { CaptchaAI } from "captchaai-javascript";

const solver = new CaptchaAI({ apiKey: process.env.CAPTCHAAI_API_KEY! });

const result = await solver.recaptchaV2(
  "YOUR_SITEKEY",
  "https://example.com"
);
console.log(result.solution);  // string — g-recaptcha-response token

await solver.close();
```

Invisible:

```ts
import { CaptchaAI } from "captchaai-javascript";

const solver = new CaptchaAI({ apiKey: process.env.CAPTCHAAI_API_KEY! });
const result = await solver.recaptchaV2("YOUR_SITEKEY", "https://example.com", {
  invisible: true,
});
console.log(result.solution);
await solver.close();
```

Enterprise (includes `userAgent` — reuse on the target site):

```ts
import { CaptchaAI } from "captchaai-javascript";

const solver = new CaptchaAI({ apiKey: process.env.CAPTCHAAI_API_KEY! });
const result = await solver.recaptchaV2("YOUR_SITEKEY", "https://example.com", {
  enterprise: true,
  action: "login",
});
console.log(result.solution, result.userAgent);
await solver.close();
```

---

### CaptchaAI: reCAPTCHA v3

Solve reCAPTCHA v3 (standard or enterprise). `action` is required — the SDK validates it before submit.

**Required:** `sitekey`, `url`, `action`  
**Optional:** `enterprise`, `minScore`, `cookies`, `userAgent`, `proxy`, `proxyType`

Standard:

```ts
import { CaptchaAI } from "captchaai-javascript";

const solver = new CaptchaAI({ apiKey: process.env.CAPTCHAAI_API_KEY! });

const result = await solver.recaptchaV3("YOUR_SITEKEY", "https://example.com", {
  action: "login",
  minScore: 0.3,
});
console.log(result.solution);  // string — v3 token

await solver.close();
```

Enterprise:

```ts
import { CaptchaAI } from "captchaai-javascript";

const solver = new CaptchaAI({ apiKey: process.env.CAPTCHAAI_API_KEY! });
const result = await solver.recaptchaV3("YOUR_SITEKEY", "https://example.com", {
  action: "login",
  enterprise: true,
});
console.log(result.solution, result.userAgent);  // reuse userAgent on target site
await solver.close();
```

---

### CaptchaAI: Cloudflare Turnstile

Solve a Cloudflare Turnstile widget.

**Required:** `sitekey`, `url`  
**Optional:** `cookies`, `userAgent`, `proxy`, `proxyType`

```ts
import { CaptchaAI } from "captchaai-javascript";

const solver = new CaptchaAI({ apiKey: process.env.CAPTCHAAI_API_KEY! });

const result = await solver.turnstile("YOUR_SITEKEY", "https://example.com", {
  cookies: "session=abc123",
  userAgent: "Mozilla/5.0 ...",
});
console.log(result.solution);  // string — Turnstile token

await solver.close();
```

---

### CaptchaAI: Cloudflare Challenge

Solve a Cloudflare interstitial challenge page. **Proxy is mandatory.**

**Required:** `url`, proxy (client-level or per-call)  
**Optional:** `cookies`, `userAgent`, `proxy`, `proxyType`

```ts
import { CaptchaAI } from "captchaai-javascript";

const solver = new CaptchaAI({
  apiKey: process.env.CAPTCHAAI_API_KEY!,
  proxy: "user:pass@host:port",
  proxyType: "HTTP",
});

const result = await solver.cloudflareChallenge("https://example.com");
console.log(result.solution, result.userAgent);  // reuse userAgent on target site

await solver.close();
```

Per-call proxy override:

```ts
import { CaptchaAI } from "captchaai-javascript";

const solver = new CaptchaAI({ apiKey: process.env.CAPTCHAAI_API_KEY! });
const result = await solver.cloudflareChallenge("https://example.com", {
  proxy: "user:pass@host:port",
  proxyType: "HTTP",
});
console.log(result.solution, result.userAgent);
await solver.close();
```

---

### CaptchaAI: GeeTest

Solve GeeTest v3. `solution` is an object with `challenge`, `validate`, and `seccode`.

**Required:** `gt`, `challenge`, `url`  
**Optional:** `cookies`, `userAgent`, `proxy`, `proxyType`

```ts
import { CaptchaAI } from "captchaai-javascript";

const solver = new CaptchaAI({ apiKey: process.env.CAPTCHAAI_API_KEY! });

const result = await solver.geetest(
  "YOUR_GT",
  "YOUR_CHALLENGE",
  "https://example.com"
);

const solution = result.solution as Record<string, string>;
console.log(solution["challenge"]);
console.log(solution["validate"]);
console.log(solution["seccode"]);

await solver.close();
```

---

### CaptchaAI: CaptchaFox

Solve a CaptchaFox slider challenge. **Proxy is mandatory.** Reuse `userAgent` when submitting the token.

**Required:** `sitekey`, `url`, proxy (client-level or per-call)  
**Optional:** `cookies`, `userAgent`, `proxy`, `proxyType`

```ts
import { CaptchaAI } from "captchaai-javascript";

const solver = new CaptchaAI({
  apiKey: process.env.CAPTCHAAI_API_KEY!,
  proxy: "user:pass@host:port",
  proxyType: "HTTP",
});

const result = await solver.captchafox("YOUR_SITEKEY", "https://example.com");
console.log(result.solution, result.userAgent);  // reuse userAgent on target site

await solver.close();
```

---

### CaptchaAI: Friendly Captcha

Solve a Friendly Captcha proof-of-work challenge. No proxy required.

**Required:** `sitekey`, `url`  
**Optional:** `version` (`"v1"` or `"v2"`), `proxy`, `proxyType`

```ts
import { CaptchaAI } from "captchaai-javascript";

const solver = new CaptchaAI({ apiKey: process.env.CAPTCHAAI_API_KEY! });

const result = await solver.friendlyCaptcha("YOUR_SITEKEY", "https://example.com", {
  version: "v1",
});
console.log(result.solution);  // string — verification token

await solver.close();
```

v2 variant:

```ts
import { CaptchaAI } from "captchaai-javascript";

const solver = new CaptchaAI({ apiKey: process.env.CAPTCHAAI_API_KEY! });
const result = await solver.friendlyCaptcha("YOUR_SITEKEY", "https://example.com", {
  version: "v2",
});
console.log(result.solution);
await solver.close();
```

---

### CaptchaAI: Lemin

Solve a Lemin puzzle. `solution` is an object with `answer` and `challenge_uuid`.

**Required:** `captchaId`, `divId`, `url`  
**Optional:** `apiServer`, `proxy`, `proxyType`

```ts
import { CaptchaAI } from "captchaai-javascript";

const solver = new CaptchaAI({ apiKey: process.env.CAPTCHAAI_API_KEY! });

const result = await solver.lemin(
  "YOUR_CAPTCHA_ID",
  "lemin-cropped-captcha",
  "https://example.com",
  { apiServer: "api.leminnow.com" }   // optional override
);

const solution = result.solution as Record<string, string>;
console.log(solution["answer"]);
console.log(solution["challenge_uuid"]);

await solver.close();
```

---

## AsyncCaptchaAI examples

### Async: Normal captcha

```ts
import { AsyncCaptchaAI } from "captchaai-javascript";

async function main() {
  const solver = await AsyncCaptchaAI.create({ apiKey: process.env.CAPTCHAAI_API_KEY! });

  const result = await solver.normal("captcha.png", {
    numeric: 1,
    minLen: 4,
    maxLen: 6,
    instructions: "Type the characters you see",
  });
  console.log(result.solution);

  await solver.aclose();
}

main();
```

From URL:

```ts
import { AsyncCaptchaAI } from "captchaai-javascript";

async function main() {
  const solver = await AsyncCaptchaAI.create({ apiKey: process.env.CAPTCHAAI_API_KEY! });
  const result = await solver.normal("https://example.com/captcha.png");
  console.log(result.solution);
  await solver.aclose();
}

main();
```

From raw base64:

```ts
import { AsyncCaptchaAI } from "captchaai-javascript";

async function main() {
  const solver = await AsyncCaptchaAI.create({ apiKey: process.env.CAPTCHAAI_API_KEY! });
  const result = await solver.normal(
    "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg=="
  );
  console.log(result.solution);
  await solver.aclose();
}

main();
```

From bytes:

```ts
import { readFile } from "node:fs/promises";
import { AsyncCaptchaAI } from "captchaai-javascript";

async function main() {
  const solver = await AsyncCaptchaAI.create({ apiKey: process.env.CAPTCHAAI_API_KEY! });
  const imageBytes = await readFile("captcha.png");
  const result = await solver.normal(imageBytes);
  console.log(result.solution);
  await solver.aclose();
}

main();
```

---

### Async: Grid captcha

```ts
import { AsyncCaptchaAI } from "captchaai-javascript";

async function main() {
  const solver = await AsyncCaptchaAI.create({ apiKey: process.env.CAPTCHAAI_API_KEY! });

  const result = await solver.grid(
    "grid.png",
    "select all traffic lights",
    "3x3"
  );
  console.log(result.solution);  // string[] — cell indices

  await solver.aclose();
}

main();
```

4x4 grid:

```ts
import { AsyncCaptchaAI } from "captchaai-javascript";

async function main() {
  const solver = await AsyncCaptchaAI.create({ apiKey: process.env.CAPTCHAAI_API_KEY! });
  const result = await solver.grid(
    "grid_4x4.png",
    "select all crosswalks",
    "4x4"
  );
  console.log(result.solution);
  await solver.aclose();
}

main();
```

---

### Async: BLS captcha

```ts
import { AsyncCaptchaAI } from "captchaai-javascript";

async function main() {
  const solver = await AsyncCaptchaAI.create({ apiKey: process.env.CAPTCHAAI_API_KEY! });

  const result = await solver.bls(
    Array.from({ length: 9 }, (_, i) => `img${i}.png`),
    "YOUR_INSTRUCTIONS"
  );
  console.log(result.solution);  // string[] — cell indices

  await solver.aclose();
}

main();
```

---

### Async: reCAPTCHA v2

Standard:

```ts
import { AsyncCaptchaAI } from "captchaai-javascript";

async function main() {
  const solver = await AsyncCaptchaAI.create({ apiKey: process.env.CAPTCHAAI_API_KEY! });
  const result = await solver.recaptchaV2("YOUR_SITEKEY", "https://example.com");
  console.log(result.solution);
  await solver.aclose();
}

main();
```

Invisible:

```ts
import { AsyncCaptchaAI } from "captchaai-javascript";

async function main() {
  const solver = await AsyncCaptchaAI.create({ apiKey: process.env.CAPTCHAAI_API_KEY! });
  const result = await solver.recaptchaV2("YOUR_SITEKEY", "https://example.com", {
    invisible: true,
  });
  console.log(result.solution);
  await solver.aclose();
}

main();
```

Enterprise:

```ts
import { AsyncCaptchaAI } from "captchaai-javascript";

async function main() {
  const solver = await AsyncCaptchaAI.create({ apiKey: process.env.CAPTCHAAI_API_KEY! });
  const result = await solver.recaptchaV2("YOUR_SITEKEY", "https://example.com", {
    enterprise: true,
    action: "login",
  });
  console.log(result.solution, result.userAgent);
  await solver.aclose();
}

main();
```

---

### Async: reCAPTCHA v3

Standard:

```ts
import { AsyncCaptchaAI } from "captchaai-javascript";

async function main() {
  const solver = await AsyncCaptchaAI.create({ apiKey: process.env.CAPTCHAAI_API_KEY! });
  const result = await solver.recaptchaV3("YOUR_SITEKEY", "https://example.com", {
    action: "login",
    minScore: 0.3,
  });
  console.log(result.solution);
  await solver.aclose();
}

main();
```

Enterprise:

```ts
import { AsyncCaptchaAI } from "captchaai-javascript";

async function main() {
  const solver = await AsyncCaptchaAI.create({ apiKey: process.env.CAPTCHAAI_API_KEY! });
  const result = await solver.recaptchaV3("YOUR_SITEKEY", "https://example.com", {
    action: "login",
    enterprise: true,
  });
  console.log(result.solution, result.userAgent);
  await solver.aclose();
}

main();
```

---

### Async: Cloudflare Turnstile

```ts
import { AsyncCaptchaAI } from "captchaai-javascript";

async function main() {
  const solver = await AsyncCaptchaAI.create({ apiKey: process.env.CAPTCHAAI_API_KEY! });
  const result = await solver.turnstile("YOUR_SITEKEY", "https://example.com", {
    cookies: "session=abc123",
    userAgent: "Mozilla/5.0 ...",
  });
  console.log(result.solution);
  await solver.aclose();
}

main();
```

---

### Async: Cloudflare Challenge

**Proxy is mandatory.**

```ts
import { AsyncCaptchaAI } from "captchaai-javascript";

async function main() {
  const solver = await AsyncCaptchaAI.create({
    apiKey: process.env.CAPTCHAAI_API_KEY!,
    proxy: "user:pass@host:port",
    proxyType: "HTTP",
  });
  const result = await solver.cloudflareChallenge("https://example.com");
  console.log(result.solution, result.userAgent);
  await solver.aclose();
}

main();
```

Per-call proxy:

```ts
import { AsyncCaptchaAI } from "captchaai-javascript";

async function main() {
  const solver = await AsyncCaptchaAI.create({ apiKey: process.env.CAPTCHAAI_API_KEY! });
  const result = await solver.cloudflareChallenge("https://example.com", {
    proxy: "user:pass@host:port",
    proxyType: "HTTP",
  });
  console.log(result.solution, result.userAgent);
  await solver.aclose();
}

main();
```

---

### Async: GeeTest

```ts
import { AsyncCaptchaAI } from "captchaai-javascript";

async function main() {
  const solver = await AsyncCaptchaAI.create({ apiKey: process.env.CAPTCHAAI_API_KEY! });
  const result = await solver.geetest(
    "YOUR_GT",
    "YOUR_CHALLENGE",
    "https://example.com"
  );
  const solution = result.solution as Record<string, string>;
  console.log(solution["challenge"]);
  console.log(solution["validate"]);
  console.log(solution["seccode"]);
  await solver.aclose();
}

main();
```

---

### Async: CaptchaFox

**Proxy is mandatory.**

```ts
import { AsyncCaptchaAI } from "captchaai-javascript";

async function main() {
  const solver = await AsyncCaptchaAI.create({
    apiKey: process.env.CAPTCHAAI_API_KEY!,
    proxy: "user:pass@host:port",
    proxyType: "HTTP",
  });
  const result = await solver.captchafox("YOUR_SITEKEY", "https://example.com");
  console.log(result.solution, result.userAgent);
  await solver.aclose();
}

main();
```

---

### Async: Friendly Captcha

```ts
import { AsyncCaptchaAI } from "captchaai-javascript";

async function main() {
  const solver = await AsyncCaptchaAI.create({ apiKey: process.env.CAPTCHAAI_API_KEY! });
  const result = await solver.friendlyCaptcha("YOUR_SITEKEY", "https://example.com", {
    version: "v1",
  });
  console.log(result.solution);
  await solver.aclose();
}

main();
```

v2 variant:

```ts
import { AsyncCaptchaAI } from "captchaai-javascript";

async function main() {
  const solver = await AsyncCaptchaAI.create({ apiKey: process.env.CAPTCHAAI_API_KEY! });
  const result = await solver.friendlyCaptcha("YOUR_SITEKEY", "https://example.com", {
    version: "v2",
  });
  console.log(result.solution);
  await solver.aclose();
}

main();
```

---

### Async: Lemin

```ts
import { AsyncCaptchaAI } from "captchaai-javascript";

async function main() {
  const solver = await AsyncCaptchaAI.create({ apiKey: process.env.CAPTCHAAI_API_KEY! });
  const result = await solver.lemin(
    "YOUR_CAPTCHA_ID",
    "lemin-cropped-captcha",
    "https://example.com",
    { apiServer: "api.leminnow.com" }
  );
  const solution = result.solution as Record<string, string>;
  console.log(solution["answer"]);
  console.log(solution["challenge_uuid"]);
  await solver.aclose();
}

main();
```

---

## Functionality examples

### Thread usage

CaptchaAI is thread-based. Check current usage:

CaptchaAI:

```ts
import { CaptchaAI } from "captchaai-javascript";

const solver = new CaptchaAI({ apiKey: process.env.CAPTCHAAI_API_KEY! });
const info = await solver.threadsInfo();
console.log(info);  // { threads: 10, workingThreads: 3 }
await solver.close();
```

AsyncCaptchaAI:

```ts
import { AsyncCaptchaAI } from "captchaai-javascript";

async function main() {
  const solver = await AsyncCaptchaAI.create({ apiKey: process.env.CAPTCHAAI_API_KEY! });
  const info = await solver.threadsInfo();
  console.log(info);
  await solver.aclose();
}

main();
```

---

### Manual submit and fetch

Submit a task now and poll later. The first argument is a registry type name (snake_case). Params use **API field names** (`googlekey`, `pageurl`), not the friendly client parameter names.

CaptchaAI:

```ts
import { CaptchaAI } from "captchaai-javascript";

const solver = new CaptchaAI({ apiKey: process.env.CAPTCHAAI_API_KEY! });

const taskId = await solver.send("recaptcha_v2", {
  googlekey: "YOUR_SITEKEY",
  pageurl: "https://example.com",
});
console.log(taskId);

const result = await solver.getResult("recaptcha_v2", taskId);
console.log(result.solution);

await solver.close();
```

AsyncCaptchaAI:

```ts
import { AsyncCaptchaAI } from "captchaai-javascript";

async function main() {
  const solver = await AsyncCaptchaAI.create({ apiKey: process.env.CAPTCHAAI_API_KEY! });

  const taskId = await solver.send("recaptcha_v2", {
    googlekey: "YOUR_SITEKEY",
    pageurl: "https://example.com",
  });
  console.log(taskId);

  const result = await solver.getResult("recaptcha_v2", taskId);
  console.log(result.solution);

  await solver.aclose();
}

main();
```

Registry type names: `normal`, `grid`, `bls`, `recaptcha_v2`, `recaptcha_v2_invisible`, `recaptcha_v2_enterprise`, `recaptcha_v3`, `recaptcha_v3_enterprise`, `turnstile`, `cloudflare_challenge`, `geetest`, `captchafox`, `friendly_captcha`, `lemin`.

---

### Error handling

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

const solver = new CaptchaAI({ apiKey: process.env.CAPTCHAAI_API_KEY! });

try {
  const result = await solver.recaptchaV2("YOUR_SITEKEY", "https://example.com");
  console.log(result.solution);
} catch (error) {
  if (error instanceof InvalidKeyError) {
    console.log("Wrong-length key, or API rejected the key");
  } else if (error instanceof ValidationError) {
    console.log("Missing/invalid params, bad image input, or missing required proxy");
  } else if (error instanceof ProxyError) {
    console.log("Bad proxy or proxy connection failed");
  } else if (error instanceof ThreadLimitError) {
    console.log("All account threads busy (retries skipped or exhausted)");
  } else if (error instanceof NoThreadsError) {
    console.log("Account expired or has no active plan");
  } else if (error instanceof UnsolvableError) {
    console.log("Service could not solve the captcha");
  } else if (error instanceof NetworkError) {
    console.log("Could not reach the API");
  } else if (error instanceof TimeoutError) {
    console.log("Poll deadline exceeded before a result was ready");
  } else if (error instanceof APIError) {
    console.log("Unexpected or malformed API response");
  } else if (error instanceof CaptchaAIError) {
    console.log("Any other SDK error");
  }
} finally {
  await solver.close();
}
```

AsyncCaptchaAI:

```ts
import { AsyncCaptchaAI, CaptchaAIError, ThreadLimitError } from "captchaai-javascript";

async function main() {
  const solver = await AsyncCaptchaAI.create({ apiKey: process.env.CAPTCHAAI_API_KEY! });
  try {
    const result = await solver.turnstile("YOUR_SITEKEY", "https://example.com");
    console.log(result.solution);
  } catch (error) {
    if (error instanceof ThreadLimitError) {
      console.log("All threads busy");
    } else if (error instanceof CaptchaAIError) {
      console.log(`SDK error: ${error.message}`);
    }
  } finally {
    await solver.aclose();
  }
}

main();
```

---

### Proxies

Format: `"user:pass@host:port"`. `proxyType` is required whenever a proxy is set (`HTTP`, `HTTPS`, `SOCKS4`, or `SOCKS5`).

Client-level (every solve):

```ts
import { CaptchaAI } from "captchaai-javascript";

const solver = new CaptchaAI({
  apiKey: process.env.CAPTCHAAI_API_KEY!,
  proxy: "user:pass@host:port",
  proxyType: "HTTP",
});
const result = await solver.recaptchaV2("YOUR_SITEKEY", "https://example.com");
console.log(result.solution);
await solver.close();
```

Per-call override (does not mutate client config):

```ts
import { CaptchaAI } from "captchaai-javascript";

const solver = new CaptchaAI({ apiKey: process.env.CAPTCHAAI_API_KEY! });
const result = await solver.recaptchaV2("YOUR_SITEKEY", "https://example.com", {
  proxy: "user:pass@other-host:port",
  proxyType: "SOCKS5",
});
console.log(result.solution);
await solver.close();
```

AsyncCaptchaAI with proxy:

```ts
import { AsyncCaptchaAI } from "captchaai-javascript";

async function main() {
  const solver = await AsyncCaptchaAI.create({
    apiKey: process.env.CAPTCHAAI_API_KEY!,
    proxy: "user:pass@host:port",
    proxyType: "HTTP",
  });
  const result = await solver.turnstile("YOUR_SITEKEY", "https://example.com");
  console.log(result.solution);
  await solver.aclose();
}

main();
```

---

### Retry behaviour

| Setting | Behaviour |
|---------|-----------|
| `autoRetry: true` (default) | Retry transient submit/proxy errors with exponential backoff |
| `autoRetry: false` | Raise immediately; fast-fails when local in-flight count hits thread cap |
| `maxRetries: N` (`N > 0`) | Like `autoRetry: true`, capped at N submit attempts |
| `maxRetries: 0` | Like `autoRetry: false` |

`maxRetries` supersedes `autoRetry` when both are provided. Fatal errors always raise immediately.

Disable retries (raise immediately):

```ts
import { CaptchaAI } from "captchaai-javascript";

const solver = new CaptchaAI({
  apiKey: process.env.CAPTCHAAI_API_KEY!,
  autoRetry: false,
});
const result = await solver.recaptchaV2("YOUR_SITEKEY", "https://example.com");
console.log(result.solution);
await solver.close();
```

Cap retries at 3 attempts:

```ts
import { CaptchaAI } from "captchaai-javascript";

const solver = new CaptchaAI({
  apiKey: process.env.CAPTCHAAI_API_KEY!,
  maxRetries: 3,
});
const result = await solver.recaptchaV2("YOUR_SITEKEY", "https://example.com");
console.log(result.solution);
await solver.close();
```

Disable retries via `maxRetries: 0`:

```ts
import { CaptchaAI } from "captchaai-javascript";

const solver = new CaptchaAI({
  apiKey: process.env.CAPTCHAAI_API_KEY!,
  maxRetries: 0,
});
const result = await solver.recaptchaV2("YOUR_SITEKEY", "https://example.com");
console.log(result.solution);
await solver.close();
```

AsyncCaptchaAI with capped retries:

```ts
import { AsyncCaptchaAI } from "captchaai-javascript";

async function main() {
  const solver = await AsyncCaptchaAI.create({
    apiKey: process.env.CAPTCHAAI_API_KEY!,
    maxRetries: 3,
  });
  const result = await solver.turnstile("YOUR_SITEKEY", "https://example.com");
  console.log(result.solution);
  await solver.aclose();
}

main();
```

---

### Resource cleanup

CaptchaAI — explicit close:

```ts
import { CaptchaAI } from "captchaai-javascript";

const solver = new CaptchaAI({ apiKey: process.env.CAPTCHAAI_API_KEY! });
const result = await solver.normal("captcha.png");
console.log(result.solution);
await solver.close();
```

AsyncCaptchaAI — explicit aclose:

```ts
import { AsyncCaptchaAI } from "captchaai-javascript";

async function main() {
  const solver = await AsyncCaptchaAI.create({ apiKey: process.env.CAPTCHAAI_API_KEY! });
  const result = await solver.normal("captcha.png");
  console.log(result.solution);
  await solver.aclose();
}

main();
```

---

### Mandatory-proxy types

These captcha types require a proxy at client level or per call:

- `cloudflareChallenge`
- `captchafox`

CaptchaAI — Cloudflare Challenge:

```ts
import { CaptchaAI } from "captchaai-javascript";

const solver = new CaptchaAI({
  apiKey: process.env.CAPTCHAAI_API_KEY!,
  proxy: "user:pass@host:port",
  proxyType: "HTTP",
});
const result = await solver.cloudflareChallenge("https://example.com");
console.log(result.solution, result.userAgent);
await solver.close();
```

CaptchaAI — CaptchaFox:

```ts
import { CaptchaAI } from "captchaai-javascript";

const solver = new CaptchaAI({
  apiKey: process.env.CAPTCHAAI_API_KEY!,
  proxy: "user:pass@host:port",
  proxyType: "HTTP",
});
const result = await solver.captchafox("YOUR_SITEKEY", "https://example.com");
console.log(result.solution, result.userAgent);
await solver.close();
```

AsyncCaptchaAI — both types:

```ts
import { AsyncCaptchaAI } from "captchaai-javascript";

async function main() {
  const solver = await AsyncCaptchaAI.create({
    apiKey: process.env.CAPTCHAAI_API_KEY!,
    proxy: "user:pass@host:port",
    proxyType: "HTTP",
  });

  const cfResult = await solver.cloudflareChallenge("https://example.com");
  console.log(cfResult.solution, cfResult.userAgent);

  const foxResult = await solver.captchafox("YOUR_SITEKEY", "https://example.com");
  console.log(foxResult.solution, foxResult.userAgent);

  await solver.aclose();
}

main();
```

---

## Placeholder reference

Replace these placeholders with your real values before running examples:

| Placeholder | Description |
|-------------|-------------|
| `CAPTCHAAI_API_KEY` | 32-character API key (env var) |
| `YOUR_SITEKEY` | reCAPTCHA / Turnstile / CaptchaFox / Friendly Captcha site key |
| `YOUR_GT` | GeeTest static `gt` value from the target site |
| `YOUR_CHALLENGE` | GeeTest dynamic `challenge` value from the target site |
| `YOUR_CAPTCHA_ID` | Lemin `captchaId` value |
| `YOUR_INSTRUCTIONS` | BLS solver instructions text |
| `user:pass@host:port` | Proxy credentials and address |
| `captcha.png`, `grid.png`, `img0.png`… | Local image file paths |
| `https://example.com` | Target page URL where the captcha appears |
| `lemin-cropped-captcha` | Lemin widget parent div `id` attribute |
| `api.leminnow.com` | Lemin API server subdomain (optional override) |
