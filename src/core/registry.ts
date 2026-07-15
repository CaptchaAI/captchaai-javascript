import { ValidationError } from "../errors.js";

export interface CaptchaTypeEntry {
  name: string;
  apiMethod: string;
  requiredParams: readonly string[];
  hasImage: boolean;
  solutionKey: "request" | "result";
  returnsUserAgent: boolean;
  isStructured: boolean;
  initialWaitMs: number;
  pollIntervalMs: number;
  submitHttpMethod: "GET" | "POST";
  requiresProxy?: boolean;
  validValues?: Record<string, readonly string[]>;
}

const s = (seconds: number): number => Math.round(seconds * 1000);

export const REGISTRY: Record<string, CaptchaTypeEntry> = {
  normal: { name: "normal", apiMethod: "base64", requiredParams: ["image"], hasImage: true, solutionKey: "request", returnsUserAgent: false, isStructured: false, initialWaitMs: s(1), pollIntervalMs: s(5), submitHttpMethod: "POST" },
  grid: { name: "grid", apiMethod: "base64", requiredParams: ["image", "instructions", "grid_size"], hasImage: true, solutionKey: "request", returnsUserAgent: false, isStructured: true, initialWaitMs: s(1), pollIntervalMs: s(5), submitHttpMethod: "POST", validValues: { grid_size: ["3x3", "4x4"] } },
  bls: { name: "bls", apiMethod: "bls", requiredParams: ["images", "instructions"], hasImage: true, solutionKey: "request", returnsUserAgent: false, isStructured: true, initialWaitMs: s(1), pollIntervalMs: s(5), submitHttpMethod: "POST" },
  recaptcha_v2: { name: "recaptcha_v2", apiMethod: "userrecaptcha", requiredParams: ["googlekey", "pageurl"], hasImage: false, solutionKey: "request", returnsUserAgent: false, isStructured: false, initialWaitMs: s(15), pollIntervalMs: s(5), submitHttpMethod: "GET" },
  recaptcha_v2_invisible: { name: "recaptcha_v2_invisible", apiMethod: "userrecaptcha", requiredParams: ["googlekey", "pageurl"], hasImage: false, solutionKey: "request", returnsUserAgent: false, isStructured: false, initialWaitMs: s(15), pollIntervalMs: s(5), submitHttpMethod: "GET" },
  recaptcha_v2_enterprise: { name: "recaptcha_v2_enterprise", apiMethod: "userrecaptcha", requiredParams: ["googlekey", "pageurl"], hasImage: false, solutionKey: "result", returnsUserAgent: true, isStructured: false, initialWaitMs: s(15), pollIntervalMs: s(5), submitHttpMethod: "POST" },
  recaptcha_v3: { name: "recaptcha_v3", apiMethod: "userrecaptcha", requiredParams: ["googlekey", "pageurl", "action"], hasImage: false, solutionKey: "request", returnsUserAgent: false, isStructured: false, initialWaitMs: s(10), pollIntervalMs: s(5), submitHttpMethod: "GET" },
  recaptcha_v3_enterprise: { name: "recaptcha_v3_enterprise", apiMethod: "userrecaptcha", requiredParams: ["googlekey", "pageurl", "action"], hasImage: false, solutionKey: "result", returnsUserAgent: true, isStructured: false, initialWaitMs: s(10), pollIntervalMs: s(5), submitHttpMethod: "POST" },
  turnstile: { name: "turnstile", apiMethod: "turnstile", requiredParams: ["sitekey", "pageurl"], hasImage: false, solutionKey: "request", returnsUserAgent: false, isStructured: false, initialWaitMs: s(10), pollIntervalMs: s(5), submitHttpMethod: "GET" },
  cloudflare_challenge: { name: "cloudflare_challenge", apiMethod: "cloudflare_challenge", requiredParams: ["pageurl"], hasImage: false, solutionKey: "result", returnsUserAgent: true, isStructured: false, initialWaitMs: s(15), pollIntervalMs: s(5), submitHttpMethod: "POST", requiresProxy: true },
  geetest: { name: "geetest", apiMethod: "geetest", requiredParams: ["gt", "challenge", "pageurl"], hasImage: false, solutionKey: "request", returnsUserAgent: false, isStructured: true, initialWaitMs: s(15), pollIntervalMs: s(5), submitHttpMethod: "GET" },
  captchafox: { name: "captchafox", apiMethod: "captchafox", requiredParams: ["sitekey", "pageurl"], hasImage: false, solutionKey: "request", returnsUserAgent: true, isStructured: false, initialWaitMs: s(10), pollIntervalMs: s(5), submitHttpMethod: "GET", requiresProxy: true },
  friendly_captcha: { name: "friendly_captcha", apiMethod: "friendly_captcha", requiredParams: ["sitekey", "pageurl"], hasImage: false, solutionKey: "request", returnsUserAgent: false, isStructured: false, initialWaitMs: s(10), pollIntervalMs: s(5), submitHttpMethod: "GET" },
  lemin: { name: "lemin", apiMethod: "lemin", requiredParams: ["captcha_id", "div_id", "pageurl"], hasImage: false, solutionKey: "request", returnsUserAgent: false, isStructured: true, initialWaitMs: s(10), pollIntervalMs: s(5), submitHttpMethod: "GET" }
};

export function getEntry(name: string): CaptchaTypeEntry {
  const entry = REGISTRY[name];
  if (!entry) {
    throw new ValidationError(`Unknown captcha type: "${name}"`);
  }
  return entry;
}
