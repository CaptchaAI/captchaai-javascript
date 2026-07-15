export interface UniformResponse {
  statusCode: number;
  body: Record<string, unknown> | undefined;
  rawText: string | undefined;
  transportErrorType: string | undefined;
  transportErrorMessage: string | undefined;
}

export interface Transport {
  requestRaw(
    method: "GET" | "POST",
    url: string,
    data: Record<string, string>
  ): Promise<UniformResponse>;
  close(): Promise<void>;
}
