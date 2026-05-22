const KEY = 'travelhub-trip-assignees-';

export function loadTripAssignees(tripId: string): string[] {
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

export function rememberTripAssignee(tripId: string, name: string): void {
  const trimmed = name.trim();
  if (!trimmed) return;
  const existing = loadTripAssignees(tripId);
  const next = [trimmed, ...existing.filter((n) => n.toLowerCase() !== trimmed.toLowerCase())].slice(0, 30);
  try {
    window.localStorage.setItem(`${KEY}${tripId}`, JSON.stringify(next));
  } catch {
    /* ignore quota */
  }
}
