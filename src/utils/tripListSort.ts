import type { Trip } from '../models/Trip';

export type TripListFilter = 'all' | 'upcoming' | 'completed';
export type UpcomingSort = 'nearest' | 'furthest';
export type CompletedSort = 'newest' | 'oldest';

export function ymdSlice(d?: string): string {
  return (d || '').trim().slice(0, 10);
}

export function todayYmdLocal(): string {
  const d = new Date();
  const pad = (n: number): string => (n < 10 ? `0${n}` : String(n));
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

export function tripEndYmd(trip: Trip): string {
  return ymdSlice(trip.dateEnd);
}

export function tripStartYmd(trip: Trip): string {
  return ymdSlice(trip.dateStart);
}

export function isCompletedTrip(trip: Trip, todayYmd: string): boolean {
  const end = tripEndYmd(trip);
  if (end && end < todayYmd) return true;
  return trip.status === 'Completed' || trip.status === 'Archived';
}

export function isUpcomingTrip(trip: Trip, todayYmd: string): boolean {
  if (isCompletedTrip(trip, todayYmd)) return false;
  const end = tripEndYmd(trip);
  if (!end) return true;
  return end >= todayYmd;
}

export function filterTrips(trips: Trip[], filter: TripListFilter, todayYmd: string): Trip[] {
  if (filter === 'all') return trips.slice();
  if (filter === 'upcoming') return trips.filter((t) => isUpcomingTrip(t, todayYmd));
  return trips.filter((t) => isCompletedTrip(t, todayYmd));
}

export function sortUpcomingTrips(trips: Trip[], sort: UpcomingSort): Trip[] {
  const out = trips.slice();
  out.sort((a, b) => {
    const cmp = tripStartYmd(a).localeCompare(tripStartYmd(b));
    return sort === 'furthest' ? -cmp : cmp;
  });
  return out;
}

export function sortCompletedTrips(trips: Trip[], sort: CompletedSort): Trip[] {
  const out = trips.slice();
  out.sort((a, b) => {
    const cmp = tripEndYmd(a).localeCompare(tripEndYmd(b));
    return sort === 'oldest' ? cmp : -cmp;
  });
  return out;
}

/** Featured "Next up" trip among upcoming list. */
export function pickNextUpTrip(upcoming: Trip[], todayYmd: string): Trip | undefined {
  if (!upcoming.length) return undefined;
  const inProgress = upcoming.filter((t) => t.status === 'In Progress');
  if (inProgress.length) {
    return sortUpcomingTrips(inProgress, 'nearest')[0];
  }
  const activeToday = upcoming.filter((t) => {
    const s = tripStartYmd(t);
    const e = tripEndYmd(t);
    return s && e && s <= todayYmd && e >= todayYmd;
  });
  if (activeToday.length) {
    return sortUpcomingTrips(activeToday, 'nearest')[0];
  }
  const future = upcoming.filter((t) => tripStartYmd(t) >= todayYmd);
  if (future.length) return sortUpcomingTrips(future, 'nearest')[0];
  return sortUpcomingTrips(upcoming, 'nearest')[0];
}

export function orderTripsForList(
  trips: Trip[],
  filter: TripListFilter,
  upcomingSort: UpcomingSort,
  completedSort: CompletedSort,
  todayYmd: string
): { ordered: Trip[]; nextUpId?: string } {
  const filtered = filterTrips(trips, filter, todayYmd);
  if (filter === 'upcoming') {
    const ordered = sortUpcomingTrips(filtered, upcomingSort);
    return { ordered, nextUpId: pickNextUpTrip(ordered, todayYmd)?.id };
  }
  if (filter === 'completed') {
    return { ordered: sortCompletedTrips(filtered, completedSort) };
  }
  const upcoming = sortUpcomingTrips(
    trips.filter((t) => isUpcomingTrip(t, todayYmd)),
    upcomingSort
  );
  const completed = sortCompletedTrips(
    trips.filter((t) => isCompletedTrip(t, todayYmd)),
    completedSort
  );
  const nextUp = pickNextUpTrip(upcoming, todayYmd);
  const ordered: Trip[] = [];
  if (nextUp) ordered.push(nextUp);
  for (const t of upcoming) {
    if (t.id !== nextUp?.id) ordered.push(t);
  }
  ordered.push(...completed);
  return { ordered, nextUpId: nextUp?.id };
}
