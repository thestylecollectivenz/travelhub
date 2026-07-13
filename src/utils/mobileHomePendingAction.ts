const KEY = 'travelhub-pending-home-add';
const KEY_ITINERARY_ADD = 'travelhub-pending-itinerary-add';
const KEY_ITINERARY_PICK_DAY = 'travelhub-pending-itinerary-pick-day';
const KEY_CAME_FROM_HOME = 'travelhub-came-from-home';
const KEY_LISTS_IDEAS = 'travelhub-pending-lists-ideas';
const KEY_JOTTER_COMPOSE = 'travelhub-pending-jotter-compose';

export type MobileHomeAddAction =
  | 'itinerary_item'
  | 'journal_entry'
  | 'journal_photo'
  | 'task'
  | 'packing_item'
  | 'shopping_item'
  | 'jotter_idea';

export const MOBILE_HOME_ADD_EVENT = 'travelhub-mobile-home-add-pending';

export function setPendingMobileHomeAdd(action: MobileHomeAddAction): void {
  try {
    window.sessionStorage.setItem(KEY, action);
    markCameFromHome();
    window.dispatchEvent(new Event(MOBILE_HOME_ADD_EVENT));
  } catch {
    /* ignore */
  }
}

export function markCameFromHome(): void {
  try {
    window.sessionStorage.setItem(KEY_CAME_FROM_HOME, '1');
  } catch {
    /* ignore */
  }
}

export function peekCameFromHome(): boolean {
  try {
    return window.sessionStorage.getItem(KEY_CAME_FROM_HOME) === '1';
  } catch {
    return false;
  }
}

export function clearCameFromHome(): void {
  try {
    window.sessionStorage.removeItem(KEY_CAME_FROM_HOME);
  } catch {
    /* ignore */
  }
}

export function setPendingItineraryAdd(requireDayPick = false): void {
  try {
    if (requireDayPick) {
      window.sessionStorage.setItem(KEY_ITINERARY_PICK_DAY, '1');
      return;
    }
    window.sessionStorage.setItem(KEY_ITINERARY_ADD, '1');
  } catch {
    /* ignore */
  }
}

export function consumePendingItineraryPickDay(): boolean {
  try {
    const v = window.sessionStorage.getItem(KEY_ITINERARY_PICK_DAY);
    window.sessionStorage.removeItem(KEY_ITINERARY_PICK_DAY);
    return v === '1';
  } catch {
    return false;
  }
}

export function peekPendingItineraryPickDay(): boolean {
  try {
    return window.sessionStorage.getItem(KEY_ITINERARY_PICK_DAY) === '1';
  } catch {
    return false;
  }
}

export function peekPendingItineraryAdd(): boolean {
  try {
    return window.sessionStorage.getItem(KEY_ITINERARY_ADD) === '1';
  } catch {
    return false;
  }
}

export function consumePendingItineraryAdd(): boolean {
  try {
    const v = window.sessionStorage.getItem(KEY_ITINERARY_ADD);
    window.sessionStorage.removeItem(KEY_ITINERARY_ADD);
    return v === '1';
  } catch {
    return false;
  }
}

export function setPendingMobileListsIdeas(openCompose = false): void {
  try {
    window.sessionStorage.setItem(KEY_LISTS_IDEAS, '1');
    if (openCompose) window.sessionStorage.setItem(KEY_JOTTER_COMPOSE, '1');
    markCameFromHome();
  } catch {
    /* ignore */
  }
}

export function consumePendingMobileListsIdeas(): boolean {
  try {
    const v = window.sessionStorage.getItem(KEY_LISTS_IDEAS);
    window.sessionStorage.removeItem(KEY_LISTS_IDEAS);
    return v === '1';
  } catch {
    return false;
  }
}

export function consumePendingJotterCompose(): boolean {
  try {
    const v = window.sessionStorage.getItem(KEY_JOTTER_COMPOSE);
    window.sessionStorage.removeItem(KEY_JOTTER_COMPOSE);
    return v === '1';
  } catch {
    return false;
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
      'jotter_idea',
      'day_idea' as MobileHomeAddAction
    ];
    if (raw === 'day_idea') return 'jotter_idea';
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
export const MOBILE_OPEN_JOTTER_COMPOSE = 'travelhub-mobile-open-jotter-compose';
