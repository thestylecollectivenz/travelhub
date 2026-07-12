import type { Trip } from '../models/Trip';
import { isUpcomingTrip, pickNextUpTrip, todayYmdLocal, tripEndYmd, tripStartYmd } from './tripListSort';

/**
 * Home / Find context trip: current trip when today falls within its dates, else next-up upcoming trip.
 */
export function resolveHomeContextTrip(trips: Trip[], todayYmd = todayYmdLocal()): Trip | undefined {
  const active = trips.find((t) => isTripActiveOnDate(t, todayYmd));
  if (active) return active;
  const upcoming = trips.filter((t) => isUpcomingTrip(t, todayYmd));
  return pickNextUpTrip(upcoming, todayYmd) ?? upcoming[0];
}

export function isTripActiveOnDate(trip: Trip, ymd: string): boolean {
  const s = tripStartYmd(trip);
  const e = tripEndYmd(trip);
  if (!s || !e) return false;
  return s <= ymd && e >= ymd;
}
