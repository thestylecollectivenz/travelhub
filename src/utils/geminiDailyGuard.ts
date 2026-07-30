/**
 * Light free-tier guard: after two quota/rate-limit rejections in a local calendar day,
 * block further Gemini calls until the next local day.
 */

const STORAGE_KEY = 'travelhub-gemini-daily-rejects-v1';
const MAX_REJECTS_PER_DAY = 2;

interface DayRejectState {
  day: string;
  count: number;
}

function localDayKey(d = new Date()): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

function readState(): DayRejectState {
  const today = localDayKey();
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return { day: today, count: 0 };
    const parsed = JSON.parse(raw) as Partial<DayRejectState>;
    if (parsed.day === today && typeof parsed.count === 'number') {
      return { day: today, count: Math.max(0, Math.floor(parsed.count)) };
    }
  } catch {
    /* ignore */
  }
  return { day: today, count: 0 };
}

function writeState(state: DayRejectState): void {
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch {
    /* ignore quota / private mode */
  }
}

/** True when Gemini should not be called for the rest of the local day. */
export function isGeminiBlockedForDay(): boolean {
  if (typeof window === 'undefined') return false;
  return readState().count >= MAX_REJECTS_PER_DAY;
}

export function geminiDailyBlockMessage(): string {
  return (
    'Gemini free-tier quota was hit twice today, so Travel Hub paused further AI calls until tomorrow. ' +
    'You can check usage in Google AI Studio → Rate limits.'
  );
}

/** Record one Google quota / 429 rejection. After two, subsequent calls are blocked until tomorrow. */
export function recordGeminiQuotaRejection(): void {
  if (typeof window === 'undefined') return;
  const state = readState();
  writeState({ day: state.day, count: state.count + 1 });
}

export function isGeminiQuotaRejection(status?: number, message?: string): boolean {
  if (status === 429) return true;
  const m = (message || '').toLowerCase();
  return (
    m.includes('quota') ||
    m.includes('resource_exhausted') ||
    m.includes('rate limit') ||
    m.includes('too many requests') ||
    m.includes('exceeded your current quota') ||
    m.includes('free_tier')
  );
}

export function isGeminiNotFoundRejection(status?: number, message?: string): boolean {
  if (status === 404) return true;
  const m = (message || '').toLowerCase();
  return m.includes('not found') || m.includes('is not found') || m.includes('not supported');
}
