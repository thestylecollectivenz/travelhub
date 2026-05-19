/** Shared Nominatim client pacing (~1 req/s) with retry on rate-limit errors. */

const MIN_GAP_MS = 1100;
const MAX_RETRIES = 3;

let nextSlotAt = 0;
let chain: Promise<void> = Promise.resolve();

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function enqueue<T>(fn: () => Promise<T>): Promise<T> {
  const run = chain.then(async () => {
    const now = Date.now();
    const wait = Math.max(0, nextSlotAt - now);
    if (wait > 0) await sleep(wait);
    // eslint-disable-next-line require-atomic-updates -- serial queue via `chain`
    nextSlotAt = Date.now() + MIN_GAP_MS;
    return fn();
  });
  chain = run.then(
    () => undefined,
    () => undefined
  );
  return run;
}

export async function nominatimFetch(url: string, init?: RequestInit): Promise<Response> {
  return enqueue(async () => {
    let lastErr: Error | undefined;
    for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
      const resp = await fetch(url, init);
      if (resp.ok) return resp;
      if (resp.status !== 429 && resp.status !== 503) {
        throw new Error(`Geocoding request failed (${resp.status})`);
      }
      lastErr = new Error(`Geocoding temporarily busy (${resp.status})`);
      if (attempt < MAX_RETRIES) {
        await sleep(1500 * Math.pow(2, attempt));
      }
    }
    throw lastErr ?? new Error('Geocoding request failed');
  });
}
