const KEY = 'travelhub-trip-booking-mechanisms-';

export function loadTripBookingMechanisms(tripId: string): string[] {
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

export function rememberTripBookingMechanism(tripId: string, value: string): void {
  const trimmed = value.trim();
  if (!trimmed) return;
  const existing = loadTripBookingMechanisms(tripId);
  const next = [trimmed, ...existing.filter((n) => n.toLowerCase() !== trimmed.toLowerCase())].slice(0, 40);
  try {
    window.localStorage.setItem(`${KEY}${tripId}`, JSON.stringify(next));
  } catch {
    /* ignore */
  }
}
