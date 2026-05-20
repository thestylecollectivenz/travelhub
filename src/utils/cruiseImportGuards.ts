import type { Trip } from '../models/Trip';
import type { TripDay } from '../models/TripDay';

/** Snapshot trip day row ids before cruise import — import must not remove any. */
export function snapshotTripDayIds(tripDays: TripDay[], tripId: string): Set<string> {
  return new Set(tripDays.filter((d) => d.tripId === tripId).map((d) => d.id));
}

export function tripDaysMissingFromSnapshot(before: Set<string>, tripDays: TripDay[], tripId: string): string[] {
  const after = new Set(tripDays.filter((d) => d.tripId === tripId).map((d) => d.id));
  return Array.from(before).filter((id) => !after.has(id));
}

export function snapshotTripDateRange(trip: Trip): { dateStart: string; dateEnd: string } {
  return {
    dateStart: (trip.dateStart || '').slice(0, 10),
    dateEnd: (trip.dateEnd || '').slice(0, 10)
  };
}

export function tripDateRangeChanged(
  before: { dateStart: string; dateEnd: string },
  trip: Trip
): boolean {
  const after = snapshotTripDateRange(trip);
  return before.dateStart !== after.dateStart || before.dateEnd !== after.dateEnd;
}
