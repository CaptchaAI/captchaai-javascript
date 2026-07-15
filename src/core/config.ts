export interface Config {
  apiKey: string;
  proxy: string | undefined;
  proxyType: string | undefined;
  autoRetry: boolean;
  baseUrl: string;
  networkTimeoutMs: number;
  maxRetries: number;
  maxPollMs: number;
  jitterMaxMs: number;
  submitBackoffBaseMs: number;
  threadBusyTimeoutMs: number;
}

export interface ClientOptions {
  proxy?: string;
  proxyType?: string;
  autoRetry?: boolean;
  baseUrl?: string;
  threadBusyTimeoutSeconds?: number;
  maxRetries?: number;
  networkTimeoutSeconds?: number;
  maxPollSeconds?: number;
  jitterMaxSeconds?: number;
  submitBackoffBaseSeconds?: number;
}

export function buildConfig(apiKey: string, options: ClientOptions = {}): Config {
  const hasMaxRetries = typeof options.maxRetries === "number";
  const maxRetries = hasMaxRetries ? Math.max(0, options.maxRetries ?? 0) : 5;
  const autoRetry = hasMaxRetries ? maxRetries > 0 : (options.autoRetry ?? true);

  return {
    apiKey,
    proxy: options.proxy,
    proxyType: options.proxyType,
    autoRetry,
    baseUrl: options.baseUrl ?? "https://ocr.captchaai.com",
    networkTimeoutMs: Math.round((options.networkTimeoutSeconds ?? 30) * 1000),
    maxRetries,
    maxPollMs: Math.round((options.maxPollSeconds ?? 180) * 1000),
    jitterMaxMs: Math.round((options.jitterMaxSeconds ?? 1) * 1000),
    submitBackoffBaseMs: Math.round((options.submitBackoffBaseSeconds ?? 5) * 1000),
    threadBusyTimeoutMs: Math.round((options.threadBusyTimeoutSeconds ?? 120) * 1000)
  };
}
