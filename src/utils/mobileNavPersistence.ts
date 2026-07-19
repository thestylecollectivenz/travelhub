/**
 * Persist mobile trip / home navigation so returning from an external website
 * (SharePoint remount / Safari) restores the last screen instead of Home.
 *
 * Uses localStorage (not sessionStorage) so iPad Safari does not drop the
 * restore key when closing an external tab / interstitial.
 */

const KEY = 'travelhub-mobile-nav-v1';
const EXTERNAL_NAV_KEY = 'travelhub-external-nav-at';

/**
 * Restore is only wanted when the page remounts because the user went to an
 * external website and came back. A plain refresh or a next-day visit should
 * start at Home as usual, so restores are gated on this recency window.
 */
const EXTERNAL_NAV_MAX_AGE_MS = 30 * 60 * 1000;

/** Call right before opening an external URL. */
export function markExternalNavigation(): void {
  try {
    window.localStorage.setItem(EXTERNAL_NAV_KEY, String(Date.now()));
  } catch {
    /* ignore */
  }
}

export function hasRecentExternalNavigation(): boolean {
  try {
    const at = Number(window.localStorage.getItem(EXTERNAL_NAV_KEY) || 0);
    return at > 0 && Date.now() - at < EXTERNAL_NAV_MAX_AGE_MS;
  } catch {
    return false;
  }
}

/**
 * URL hash marker that makes deep app screens behave like proper pages: while
 * the user is inside a trip the URL carries "#thnav", so any reload (manual
 * refresh, or SharePoint remounting after an external website) restores the
 * saved screen from localStorage. Going back Home removes the marker, so a
 * fresh visit starts at Home as usual.
 */
const NAV_HASH = '#thnav';

/** Keep the URL hash in sync with whether deep state exists. */
export function syncNavHash(deepState: boolean): void {
  try {
    const hasMarker = window.location.hash.indexOf(NAV_HASH) === 0;
    if (deepState === hasMarker) return;
    const base = window.location.pathname + window.location.search;
    window.history.replaceState(window.history.state, '', deepState ? base + NAV_HASH : base);
  } catch {
    /* ignore */
  }
}

/** Restore saved navigation on this mount? True after external-site returns and marked reloads. */
export function shouldRestoreMobileNav(): boolean {
  try {
    if (window.location.hash.indexOf(NAV_HASH) === 0) return true;
  } catch {
    /* ignore */
  }
  return hasRecentExternalNavigation();
}

/**
 * Catch every external link click (plain <a target="_blank"> included) so the
 * restore gate works regardless of how the link was rendered.
 */
export function installExternalNavigationTracker(): () => void {
  const onClick = (ev: MouseEvent): void => {
    const target = ev.target as HTMLElement | null;
    const anchor = target?.closest ? target.closest('a[href]') : null;
    if (!anchor) return;
    const href = anchor.getAttribute('href') || '';
    if (!/^https?:\/\//i.test(href)) return;
    try {
      if (new URL(href).origin === window.location.origin) return;
    } catch {
      return;
    }
    markExternalNavigation();
  };
  document.addEventListener('click', onClick, true);
  return () => document.removeEventListener('click', onClick, true);
}

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
    syncNavHash(next.view === 'singleTrip');
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
    syncNavHash(false);
  } catch {
    /* ignore */
  }
}
