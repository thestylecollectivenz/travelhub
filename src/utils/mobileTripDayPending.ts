const KEY = 'travelhub-pending-trip-day';

export function peekPendingTripDay(expectedTripId: string): string | null {
  try {
    const raw = window.sessionStorage.getItem(KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as { tripId?: string; dayId?: string };
    if (parsed.tripId !== expectedTripId || !parsed.dayId) return null;
    return parsed.dayId;
  } catch {
    return null;
  }
}

export function setPendingTripDay(tripId: string, dayId: string): void {
  try {
    window.sessionStorage.setItem(KEY, JSON.stringify({ tripId, dayId }));
  } catch {
    /* ignore */
  }
}

export function consumePendingTripDay(expectedTripId: string): string | null {
  try {
    const raw = window.sessionStorage.getItem(KEY);
    window.sessionStorage.removeItem(KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as { tripId?: string; dayId?: string };
    if (parsed.tripId !== expectedTripId || !parsed.dayId) return null;
    return parsed.dayId;
  } catch {
    return null;
  }
}
