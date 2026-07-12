const ENTRY_KEY = 'travelhub-pending-edit-entry-id';
const DAY_KEY = 'travelhub-pending-edit-day-id';

export function setPendingMobileItineraryEdit(entryId: string, dayId: string): void {
  try {
    window.sessionStorage.setItem(ENTRY_KEY, entryId);
    window.sessionStorage.setItem(DAY_KEY, dayId);
  } catch {
    /* ignore */
  }
}

export function consumePendingMobileItineraryEdit(): { entryId: string; dayId: string } | null {
  try {
    const entryId = window.sessionStorage.getItem(ENTRY_KEY);
    const dayId = window.sessionStorage.getItem(DAY_KEY);
    window.sessionStorage.removeItem(ENTRY_KEY);
    window.sessionStorage.removeItem(DAY_KEY);
    if (!entryId || !dayId) return null;
    return { entryId, dayId };
  } catch {
    return null;
  }
}
