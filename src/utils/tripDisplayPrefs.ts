import type { Trip } from '../models/Trip';

export type TripDisplayPrefs = Pick<Trip, 'showAuthorName' | 'showJournalEntryDate'>;

function storageKey(tripId: string): string {
  return `travelhub-trip-display-${tripId}`;
}

export function loadTripDisplayPrefs(tripId: string): Partial<TripDisplayPrefs> {
  if (!tripId) return {};
  try {
    const raw = window.localStorage.getItem(storageKey(tripId));
    if (!raw) return {};
    const parsed = JSON.parse(raw) as Partial<TripDisplayPrefs>;
    const result: Partial<TripDisplayPrefs> = {};
    if (typeof parsed.showAuthorName === 'boolean') result.showAuthorName = parsed.showAuthorName;
    if (typeof parsed.showJournalEntryDate === 'boolean') result.showJournalEntryDate = parsed.showJournalEntryDate;
    return result;
  } catch {
    return {};
  }
}

export function saveTripDisplayPrefs(tripId: string, partial: Partial<TripDisplayPrefs>): void {
  if (!tripId) return;
  const prev = loadTripDisplayPrefs(tripId);
  const next: Partial<TripDisplayPrefs> = { ...prev, ...partial };
  try {
    window.localStorage.setItem(storageKey(tripId), JSON.stringify(next));
  } catch {
    // ignore quota errors
  }
}

export function mergeTripDisplayPrefs(trip: Trip): Trip {
  const saved = loadTripDisplayPrefs(trip.id);
  if (typeof saved.showAuthorName !== 'boolean' && typeof saved.showJournalEntryDate !== 'boolean') {
    return trip;
  }
  return {
    ...trip,
    ...(typeof saved.showAuthorName === 'boolean' ? { showAuthorName: saved.showAuthorName } : {}),
    ...(typeof saved.showJournalEntryDate === 'boolean' ? { showJournalEntryDate: saved.showJournalEntryDate } : {})
  };
}
