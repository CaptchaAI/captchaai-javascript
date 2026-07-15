export { CaptchaAI } from "./client.js";
export { AsyncCaptchaAI } from "./async-client.js";
export { SolveResult } from "./core/result.js";
export type { SolveResultInit, SolveSolution } from "./core/result.js";
export type { CaptchaAIConstructorOptions } from "./client.js";
export type { ProxyType, ImageInput, PerCallProxyOptions, BrowserSolveOptions } from "./types.js";
export {
  CaptchaAIError,
  InvalidKeyError,
  ValidationError,
  ProxyError,
  ThreadLimitError,
  NoThreadsError,
  UnsolvableError,
  APIError,
  NetworkError,
  TimeoutError
} from "./errors.js";
