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
 * Proper-page routing via the URL hash. While the user is inside a trip the
 * URL always encodes the full route, e.g.
 *
 *   #th/trip/<tripId>/<tab>
 *   #th/trip/<tripId>/<tab>/loc/<entryId>
 *   #th/trip/<tripId>/<tab>/loc/<entryId>/explore/<category>
 *   #th/trip/<tripId>/<tab>/loc/<entryId>/saved/<category?>
 *
 * Any reload — manual refresh, or SharePoint remounting the page after the
 * user returns from an external website — reopens exactly that route.
 * Going back Home clears the hash, so a fresh visit starts at Home.
 */
const HASH_PREFIX = '#th/';
/** Pre-1.0.11.207 marker; still honoured as "restore from localStorage". */
const LEGACY_NAV_HASH = '#thnav';

export interface ParsedNavHash {
  tripId: string;
  tripTab?: string;
  locationEntryId?: string;
  locationPanel?: 'explore' | 'saved';
  /** Explore category or saved-places category, depending on locationPanel. */
  panelCategory?: string;
}

function buildNavHash(nav: PersistedMobileNav): string {
  if (nav.view !== 'singleTrip' || !(nav.tripId || '').trim()) return '';
  const seg = (v: string): string => encodeURIComponent(v);
  let hash = `${HASH_PREFIX}trip/${seg(nav.tripId!.trim())}/${seg((nav.tripTab || 'today').trim() || 'today')}`;
  if ((nav.locationEntryId || '').trim()) {
    hash += `/loc/${seg(nav.locationEntryId!.trim())}`;
    if (nav.locationPanel === 'explore' || nav.locationPanel === 'saved') {
      hash += `/${nav.locationPanel}`;
      if ((nav.exploreCategory || '').trim()) hash += `/${seg(nav.exploreCategory!.trim())}`;
    }
  }
  return hash;
}

export function parseNavHash(): ParsedNavHash | undefined {
  try {
    const hash = window.location.hash || '';
    if (hash.indexOf(HASH_PREFIX) !== 0) return undefined;
    const parts = hash.slice(HASH_PREFIX.length).split('/').map((p) => {
      try {
        return decodeURIComponent(p);
      } catch {
        return p;
      }
    });
    if (parts[0] !== 'trip' || !(parts[1] || '').trim()) return undefined;
    const out: ParsedNavHash = { tripId: parts[1].trim(), tripTab: (parts[2] || '').trim() || undefined };
    if (parts[3] === 'loc' && (parts[4] || '').trim()) {
      out.locationEntryId = parts[4].trim();
      if (parts[5] === 'explore' || parts[5] === 'saved') {
        out.locationPanel = parts[5];
        out.panelCategory = (parts[6] || '').trim() || undefined;
      }
    }
    return out;
  } catch {
    return undefined;
  }
}

/** Keep the URL hash in sync with the current navigation state. */
export function syncNavHash(nav: PersistedMobileNav): void {
  try {
    const next = buildNavHash(nav);
    const current = window.location.hash || '';
    if (next === current) return;
    if (!next && current.indexOf(HASH_PREFIX) !== 0 && current.indexOf(LEGACY_NAV_HASH) !== 0) {
      return; // never clobber a non-TravelHub hash
    }
    const base = window.location.pathname + window.location.search;
    window.history.replaceState(window.history.state, '', next ? base + next : base);
  } catch {
    /* ignore */
  }
}

/** Restore deep sub-screens (location info, explore) after external-site return only. */
export function shouldRestoreMobileNav(): boolean {
  return hasRecentExternalNavigation();
}

/** Trip + tab from URL hash on any reload (hash is the page route). */
export function hasTripNavHash(): boolean {
  try {
    const hash = window.location.hash || '';
    return hash.indexOf(HASH_PREFIX) === 0;
  } catch {
    return false;
  }
}

/** Clear the external-return marker once deep state has been restored. */
export function clearExternalNavigationMarker(): void {
  try {
    window.localStorage.removeItem(EXTERNAL_NAV_KEY);
  } catch {
    /* ignore */
  }
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
    syncNavHash(next);
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
    syncNavHash(next);
  } catch {
    /* ignore */
  }
}
