export type DayPlanningStatus = 'NotStarted' | 'InProgress' | 'Complete';

const STORAGE_PREFIX = 'travelHub.dayPlanningStatus';

function storageKey(tripId: string): string {
  return `${STORAGE_PREFIX}.${tripId}`;
}

export function loadDayPlanningStatusMap(tripId: string): Record<string, DayPlanningStatus> {
  if (!tripId) return {};
  try {
    const raw = window.localStorage.getItem(storageKey(tripId));
    if (!raw) return {};
    const parsed = JSON.parse(raw) as Record<string, DayPlanningStatus>;
    return parsed && typeof parsed === 'object' ? parsed : {};
  } catch {
    return {};
  }
}

export function loadDayPlanningStatus(tripId: string, dayId: string): DayPlanningStatus {
  return loadDayPlanningStatusMap(tripId)[dayId] ?? 'NotStarted';
}

export function saveDayPlanningStatus(tripId: string, dayId: string, status: DayPlanningStatus): void {
  if (!tripId || !dayId) return;
  try {
    const map = loadDayPlanningStatusMap(tripId);
    map[dayId] = status;
    window.localStorage.setItem(storageKey(tripId), JSON.stringify(map));
    window.dispatchEvent(new CustomEvent('travelhub-day-planning-status', { detail: { tripId, dayId, status } }));
  } catch {
    /* ignore */
  }
}

export function dayPlanningStatusLabel(status: DayPlanningStatus): string {
  switch (status) {
    case 'Complete':
      return 'Complete';
    case 'InProgress':
      return 'In progress';
    default:
      return 'Not started';
  }
}
