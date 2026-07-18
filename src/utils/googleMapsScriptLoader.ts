/**
 * Single robust loader for the Google Maps JS + Places library.
 *
 * Fixes a session-killing failure mode: if a previously injected script tag
 * failed (network blip, content blocker), its load/error events never fire
 * again, so naive loaders wait on a dead tag forever. This loader polls for
 * the namespace, removes dead tags, and allows retries on later calls.
 */

const SCRIPT_SELECTOR = 'script[data-th-google-places]';
const TIMEOUT_MS = 12000;
const POLL_MS = 250;

export type MapsLoadFailure = 'script-error' | 'timeout' | undefined;

export interface MapsLoadResult {
  ok: boolean;
  failure?: MapsLoadFailure;
}

let inFlight: Promise<MapsLoadResult> | null = null;
let lastFailure: MapsLoadFailure;

function hasPlaces(): boolean {
  const w = window as unknown as { google?: { maps?: { places?: unknown } } };
  return Boolean(w.google?.maps?.places);
}

export function lastMapsLoadFailure(): MapsLoadFailure {
  return lastFailure;
}

function removeDeadTag(): void {
  if (hasPlaces()) return;
  const tag = document.querySelector(SCRIPT_SELECTOR);
  if (tag) tag.remove();
}

export function loadGoogleMapsPlacesScript(apiKey: string): Promise<MapsLoadResult> {
  if (hasPlaces()) return Promise.resolve({ ok: true });
  if (!apiKey.trim()) return Promise.resolve({ ok: false, failure: 'script-error' });
  if (inFlight) return inFlight;

  inFlight = new Promise<MapsLoadResult>((resolve) => {
    let settled = false;
    let poll = 0;
    let timer = 0;
    const finish = (result: MapsLoadResult): void => {
      if (settled) return;
      settled = true;
      window.clearInterval(poll);
      window.clearTimeout(timer);
      inFlight = null;
      lastFailure = result.ok ? undefined : result.failure;
      resolve(result);
    };

    // Poll: catches the case where the tag was injected earlier (possibly by
    // another loader) and has already loaded — its events will never re-fire.
    poll = window.setInterval(() => {
      if (hasPlaces()) finish({ ok: true });
    }, POLL_MS);

    timer = window.setTimeout(() => {
      // Dead or too slow — remove the tag so the next attempt starts fresh.
      removeDeadTag();
      finish(hasPlaces() ? { ok: true } : { ok: false, failure: 'timeout' });
    }, TIMEOUT_MS);

    let tag = document.querySelector<HTMLScriptElement>(SCRIPT_SELECTOR);
    if (!tag) {
      tag = document.createElement('script');
      tag.dataset.thGooglePlaces = '1';
      tag.async = true;
      tag.src = `https://maps.googleapis.com/maps/api/js?key=${encodeURIComponent(apiKey)}&libraries=places`;
      document.head.appendChild(tag);
    }
    tag.addEventListener('load', () => finish(hasPlaces() ? { ok: true } : { ok: false, failure: 'script-error' }));
    tag.addEventListener('error', () => {
      removeDeadTag();
      finish({ ok: false, failure: 'script-error' });
    });
  });
  return inFlight;
}
