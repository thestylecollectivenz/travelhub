const KEY = 'travelhub-trip-travellers-';

export function loadTripTravellers(tripId: string): string[] {
  try {
    const raw = window.localStorage.getItem(`${KEY}${tripId}`);
    if (!raw) return ['Traveller 1'];
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return ['Traveller 1'];
    const names = parsed.filter((x) => typeof x === 'string' && x.trim()).map((x) => (x as string).trim());
    return names.length ? names : ['Traveller 1'];
  } catch {
    return ['Traveller 1'];
  }
}

export function saveTripTravellers(tripId: string, names: string[]): void {
  try {
    const cleaned = names.map((n) => n.trim()).filter(Boolean);
    window.localStorage.setItem(`${KEY}${tripId}`, JSON.stringify(cleaned.length ? cleaned : ['Traveller 1']));
  } catch {
    /* ignore */
  }
}

/** Merge trip member display names into the traveller pick list (case-insensitive). */
export function mergeTripTravellersWithMembers(tripId: string, members: Array<{ userDisplayName: string }>): string[] {
  const existing = loadTripTravellers(tripId);
  const seen = new Set(existing.map((n) => n.toLowerCase()));
  const merged = [...existing];
  for (const m of members) {
    const name = (m.userDisplayName || '').trim();
    if (!name) continue;
    const key = name.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    merged.push(name);
  }
  saveTripTravellers(tripId, merged);
  return merged.length ? merged : ['Traveller 1'];
}
