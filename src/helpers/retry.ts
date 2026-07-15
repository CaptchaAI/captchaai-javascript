export function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export function addJitter(ms: number, jitterMaxMs: number): number {
  return ms + Math.floor(Math.random() * (jitterMaxMs + 1));
}

export function* exponential(baseMs: number, jitterMaxMs: number, factor = 2): Generator<number> {
  let step = 0;
  while (true) {
    const wait = baseMs * factor ** step;
    yield addJitter(wait, jitterMaxMs);
    step += 1;
  }
}

export function* threadBusyBackoff(intervalMs = 8000, jitterMaxMs = 3000): Generator<number> {
  while (true) {
    yield addJitter(intervalMs, jitterMaxMs);
  }
}
