import { UniformResponse, Transport } from "./base.js";

function withTimeout(timeoutMs: number): AbortSignal {
  return AbortSignal.timeout(timeoutMs);
}

function toRecord(value: unknown): Record<string, unknown> | undefined {
  if (value && typeof value === "object" && !Array.isArray(value)) {
    return value as Record<string, unknown>;
  }
  return undefined;
}

export class FetchTransport implements Transport {
  public constructor(private readonly timeoutMs: number) {}

  public async requestRaw(
    method: "GET" | "POST",
    url: string,
    data: Record<string, string>
  ): Promise<UniformResponse> {
    try {
      let requestUrl = url;
      let init: RequestInit = { method, signal: withTimeout(this.timeoutMs) };

      if (method === "GET") {
        const query = new URLSearchParams(data);
        requestUrl = `${url}?${query.toString()}`;
      } else {
        init = {
          ...init,
          headers: { "Content-Type": "application/x-www-form-urlencoded" },
          body: new URLSearchParams(data).toString()
        };
      }

      const response = await fetch(requestUrl, init);
      const text = await response.text();
      try {
        const parsed: unknown = JSON.parse(text);
        return {
          statusCode: response.status,
          body: toRecord(parsed),
          rawText: text,
          transportErrorType: undefined,
          transportErrorMessage: undefined
        };
      } catch {
        return {
          statusCode: response.status,
          body: undefined,
          rawText: text,
          transportErrorType: undefined,
          transportErrorMessage: undefined
        };
      }
    } catch (error: unknown) {
      const err = error as Error;
      return {
        statusCode: 999,
        body: undefined,
        rawText: undefined,
        transportErrorType: err?.name,
        transportErrorMessage: err?.message
      };
    }
  }

  public async close(): Promise<void> {
    return;
  }
}
