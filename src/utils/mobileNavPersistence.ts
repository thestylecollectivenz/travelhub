/**
 * Persist mobile trip / home navigation so returning from an external website
 * (SharePoint remount / Safari) restores the last screen instead of Home.
 *
 * Uses localStorage (not sessionStorage) so iPad Safari does not drop the
 * restore key when closing an external tab / interstitial.
 */

const KEY = 'travelhub-mobile-nav-v1';

export type PersistedMobileNav = {
  view?: 'multiTrip' | 'singleTrip';
  tripId?: string;
  tripTab?: string;
  homeTab?: string;
  /** Location-info sheet panel when leaving for an external site. */
  locationPanel?: string;
  locationEntryId?: string;
  exploreCategory?: string;
  updatedAt?: number;
};

export function loadPersistedMobileNav(): PersistedMobileNav {
  try {
    const raw = window.localStorage.getItem(KEY) || window.sessionStorage.getItem(KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw) as PersistedMobileNav;
    return parsed && typeof parsed === 'object' ? parsed : {};
  } catch {
    return {};
  }
}

export function persistMobileNav(partial: PersistedMobileNav): void {
  try {
    const next = { ...loadPersistedMobileNav(), ...partial, updatedAt: Date.now() };
    const json = JSON.stringify(next);
    window.localStorage.setItem(KEY, json);
    // Keep session copy in sync for any older readers still on sessionStorage.
    try {
      window.sessionStorage.setItem(KEY, json);
    } catch {
      /* ignore */
    }
  } catch {
    /* ignore */
  }
}

export function clearPersistedTripNav(): void {
  try {
    const cur = loadPersistedMobileNav();
    const next = {
      view: 'multiTrip' as const,
      homeTab: cur.homeTab || 'home',
      updatedAt: Date.now()
    };
    const json = JSON.stringify(next);
    window.localStorage.setItem(KEY, json);
    try {
      window.sessionStorage.setItem(KEY, json);
    } catch {
      /* ignore */
    }
  } catch {
    /* ignore */
  }
}
