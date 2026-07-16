const KEY = 'travelhub-trip-task-categories-';

export const DEFAULT_TASK_CATEGORIES = [
  'To Do',
  'Booking',
  'Payment',
  'Pre-trip',
  'Itinerary updates',
  'Other'
] as const;

export function loadTripTaskCategories(tripId: string): string[] {
  try {
    const raw = window.localStorage.getItem(`${KEY}${tripId}`);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return [];
    return parsed.map((n) => String(n).trim()).filter(Boolean);
  } catch {
    return [];
  }
}

export function rememberTripTaskCategory(tripId: string, category: string): void {
  const trimmed = category.trim();
  if (!trimmed) return;
  const existing = loadTripTaskCategories(tripId);
  const next = [trimmed, ...existing.filter((n) => n.toLowerCase() !== trimmed.toLowerCase())].slice(0, 40);
  try {
    window.localStorage.setItem(`${KEY}${tripId}`, JSON.stringify(next));
  } catch {
    /* ignore quota */
  }
}

export function buildTaskCategoryOptions(tripId: string | undefined, extra: string[] = []): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  const add = (raw: string): void => {
    const t = (raw || '').trim();
    if (!t) return;
    const k = t.toLowerCase();
    if (seen.has(k)) return;
    seen.add(k);
    out.push(t);
  };
  for (const c of DEFAULT_TASK_CATEGORIES) add(c);
  if (tripId) {
    for (const c of loadTripTaskCategories(tripId)) add(c);
  }
  for (const c of extra) add(c);
  return out.sort((a, b) => a.localeCompare(b, undefined, { sensitivity: 'base' }));
}

export function resolveTaskCategorySelection(
  selected: string,
  custom: string,
  fallback = 'Other'
): string {
  if (selected === '__custom__') return custom.trim() || fallback;
  return selected.trim() || fallback;
}
