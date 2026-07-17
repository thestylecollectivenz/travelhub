/**
 * Persist mobile trip / home navigation so returning from an external website
 * (SharePoint remount / Safari) restores the last screen instead of Home.
 */

const KEY = 'travelhub-mobile-nav-v1';

export type PersistedMobileNav = {
  view?: 'multiTrip' | 'singleTrip';
  tripId?: string;
  tripTab?: string;
  homeTab?: string;
  updatedAt?: number;
};

export function loadPersistedMobileNav(): PersistedMobileNav {
  try {
    const raw = window.sessionStorage.getItem(KEY);
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
    window.sessionStorage.setItem(KEY, JSON.stringify(next));
  } catch {
    /* ignore */
  }
}

export function clearPersistedTripNav(): void {
  try {
    const cur = loadPersistedMobileNav();
    window.sessionStorage.setItem(
      KEY,
      JSON.stringify({
        view: 'multiTrip',
        homeTab: cur.homeTab || 'home',
        updatedAt: Date.now()
      })
    );
  } catch {
    /* ignore */
  }
}
