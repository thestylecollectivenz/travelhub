import type { DayPlanningStatus } from '../models/TripDay';

export type { DayPlanningStatus };

const STORAGE_PREFIX = 'travelHub.dayPlanningStatus';

function storageKey(tripId: string): string {
  return `${STORAGE_PREFIX}.${tripId}`;
}

/** One-time migration from legacy browser storage. */
export function loadLegacyDayPlanningStatus(tripId: string, dayId: string): DayPlanningStatus | undefined {
  if (!tripId) return undefined;
  try {
    const raw = window.localStorage.getItem(storageKey(tripId));
    if (!raw) return undefined;
    const parsed = JSON.parse(raw) as Record<string, DayPlanningStatus>;
    return parsed?.[dayId];
  } catch {
    return undefined;
  }
}

export function clearLegacyDayPlanningStatus(tripId: string): void {
  try {
    window.localStorage.removeItem(storageKey(tripId));
  } catch {
    /* ignore */
  }
}

export function dayPlanningStatusLabel(status: DayPlanningStatus | undefined): string {
  switch (status) {
    case 'Complete':
      return 'Complete';
    case 'InProgress':
      return 'In progress';
    default:
      return 'Not started';
  }
}

export function normalizeDayPlanningStatus(value: string | undefined): DayPlanningStatus {
  if (value === 'Complete' || value === 'InProgress' || value === 'NotStarted') return value;
  return 'NotStarted';
}
