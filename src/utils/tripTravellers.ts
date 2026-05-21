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
