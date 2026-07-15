import { vi } from "vitest";

export async function advanceTimers(ms: number): Promise<void> {
  await vi.advanceTimersByTimeAsync(ms);
}

export function useFakeTimers(): void {
  vi.useFakeTimers();
}
