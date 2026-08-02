const ENTRY_KEY = 'travelhub-pending-open-entry-id';
const DAY_KEY = 'travelhub-pending-open-day-id';
const SUB_KEY = 'travelhub-pending-open-sub-id';

/** Queue a mobile itinerary card detail open (read mode) after navigating to the day. */
export function setPendingMobileItineraryOpen(entryId: string, dayId: string, subItemId?: string): void {
  try {
    window.sessionStorage.setItem(ENTRY_KEY, entryId);
    window.sessionStorage.setItem(DAY_KEY, dayId);
    if (subItemId) window.sessionStorage.setItem(SUB_KEY, subItemId);
    else window.sessionStorage.removeItem(SUB_KEY);
  } catch {
    /* ignore */
  }
}

export function peekPendingMobileItineraryOpen(): {
  entryId: string;
  dayId: string;
  subItemId?: string;
} | null {
  try {
    const entryId = window.sessionStorage.getItem(ENTRY_KEY);
    const dayId = window.sessionStorage.getItem(DAY_KEY);
    const subItemId = window.sessionStorage.getItem(SUB_KEY) || undefined;
    if (!entryId || !dayId) return null;
    return { entryId, dayId, subItemId };
  } catch {
    return null;
  }
}

export function consumePendingMobileItineraryOpen(): {
  entryId: string;
  dayId: string;
  subItemId?: string;
} | null {
  const pending = peekPendingMobileItineraryOpen();
  try {
    window.sessionStorage.removeItem(ENTRY_KEY);
    window.sessionStorage.removeItem(DAY_KEY);
    window.sessionStorage.removeItem(SUB_KEY);
  } catch {
    /* ignore */
  }
  return pending;
}
