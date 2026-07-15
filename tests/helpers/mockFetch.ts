import { vi } from "vitest";

export interface MockFetchOptions {
  threads?: number;
  workingThreads?: number;
  taskId?: string;
  solution?: string | Record<string, unknown>;
  solutionKey?: "request" | "result";
  userAgent?: string;
  pollNotReadyCount?: number;
  submitError?: string;
  pollError?: string;
  threadsInfoError?: string;
  networkError?: boolean;
  onRequest?: (info: {
    method: string;
    url: string;
    body: Record<string, string>;
  }) => void;
}

function parseBody(init?: RequestInit): Record<string, string> {
  if (!init?.body || typeof init.body !== "string") {
    return {};
  }
  return Object.fromEntries(new URLSearchParams(init.body));
}

function parseQuery(url: string): Record<string, string> {
  const parsed = new URL(url);
  return Object.fromEntries(parsed.searchParams.entries());
}

function jsonResponse(payload: unknown, status = 200): Response {
  return new Response(JSON.stringify(payload), {
    status,
    headers: { "Content-Type": "application/json" }
  });
}

export function installMockFetch(options: MockFetchOptions = {}): void {
  const {
    threads = 10,
    workingThreads = 0,
    taskId = "12345678",
    solution = "solved-token",
    solutionKey = "request",
    userAgent = "TestAgent/1.0",
    pollNotReadyCount = 0,
    submitError,
    pollError,
    threadsInfoError,
    networkError = false,
    onRequest
  } = options;

  let pollCalls = 0;

  const fetchMock = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
    if (networkError) {
      throw new TypeError("Failed to fetch");
    }

    const url = String(input);
    const method = init?.method ?? "GET";
    const body = method === "GET" ? parseQuery(url) : parseBody(init);

    onRequest?.({ method, url, body });

    if (url.includes("res.php")) {
      if (body.action === "threadsinfo") {
        if (threadsInfoError) {
          return jsonResponse({ status: 0, request: threadsInfoError });
        }
        return jsonResponse({
          status: 1,
          threads,
          working_threads: workingThreads
        });
      }

      if (body.action === "get") {
        if (pollError) {
          return jsonResponse({ status: 0, request: pollError });
        }
        if (pollCalls < pollNotReadyCount) {
          pollCalls += 1;
          return jsonResponse({ status: 0, request: "CAPCHA_NOT_READY" });
        }

        const payload: Record<string, unknown> = { status: 1 };
        if (typeof solution === "string") {
          payload[solutionKey] = solution;
          if (solutionKey === "result") {
            payload.user_agent = userAgent;
          }
        } else {
          Object.assign(payload, solution);
          payload.status = 1;
        }
        return jsonResponse(payload);
      }
    }

    if (url.includes("in.php")) {
      if (submitError) {
        return jsonResponse({ status: 0, request: submitError });
      }
      return jsonResponse({ status: 1, request: taskId });
    }

    return jsonResponse({ status: 0, request: "ERROR_BAD_PARAMETERS" }, 404);
  });

  vi.stubGlobal("fetch", fetchMock);
}

export function captureRequests(): {
  install: (options?: Omit<MockFetchOptions, "onRequest">) => void;
  requests: Array<{ method: string; url: string; body: Record<string, string> }>;
} {
  const requests: Array<{ method: string; url: string; body: Record<string, string> }> = [];
  return {
    requests,
    install: (options = {}) => {
      installMockFetch({
        ...options,
        onRequest: (info) => {
          requests.push(info);
        }
      });
    }
  };
}
