const KEY = 'travelhub-pending-home-add';

export type MobileHomeAddAction =
  | 'itinerary_item'
  | 'journal_entry'
  | 'journal_photo'
  | 'task'
  | 'packing_item'
  | 'shopping_item'
  | 'day_idea';

export const MOBILE_HOME_ADD_EVENT = 'travelhub-mobile-home-add-pending';

export function setPendingMobileHomeAdd(action: MobileHomeAddAction): void {
  try {
    window.sessionStorage.setItem(KEY, action);
    window.dispatchEvent(new Event(MOBILE_HOME_ADD_EVENT));
  } catch {
    /* ignore */
  }
}

export function consumePendingMobileHomeAdd(): MobileHomeAddAction | null {
  try {
    const raw = window.sessionStorage.getItem(KEY);
    window.sessionStorage.removeItem(KEY);
    if (!raw) return null;
    const allowed: MobileHomeAddAction[] = [
      'itinerary_item',
      'journal_entry',
      'journal_photo',
      'task',
      'packing_item',
      'shopping_item',
      'day_idea'
    ];
    return allowed.includes(raw as MobileHomeAddAction) ? (raw as MobileHomeAddAction) : null;
  } catch {
    return null;
  }
}

/** Child views listen for these after tab switch. */
export const MOBILE_START_ITINERARY_ADD = 'travelhub-mobile-start-itinerary-add';
export const MOBILE_OPEN_JOURNAL_COMPOSER = 'travelhub-mobile-open-journal-composer';
export const MOBILE_OPEN_PHOTO_UPLOAD = 'travelhub-mobile-open-photo-upload';
export const MOBILE_OPEN_TASK_ADD = 'travelhub-mobile-open-task-add';
export const MOBILE_OPEN_PACKING_ADD = 'travelhub-mobile-open-packing-add';
export const MOBILE_OPEN_SHOPPING_ADD = 'travelhub-mobile-open-shopping-add';
export const MOBILE_OPEN_LISTS_IDEAS = 'travelhub-mobile-open-lists-ideas';
