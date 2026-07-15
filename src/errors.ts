export class CaptchaAIError extends Error {
  public constructor(message: string) {
    super(message);
    this.name = new.target.name;
  }
}

export class InvalidKeyError extends CaptchaAIError {}
export class ValidationError extends CaptchaAIError {}
export class ProxyError extends CaptchaAIError {}
export class ThreadLimitError extends CaptchaAIError {}
export class NoThreadsError extends CaptchaAIError {}
export class UnsolvableError extends CaptchaAIError {}
export class APIError extends CaptchaAIError {}
export class NetworkError extends CaptchaAIError {}
export class TimeoutError extends CaptchaAIError {}
