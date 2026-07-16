export interface NearYouCachedResult {
  id: string;
  name: string;
  note?: string;
  address?: string;
  rating?: number;
  priceLevel?: string;
  mapsUrl?: string;
  websiteUrl?: string;
  reviewsUrl?: string;
  aiBlurb?: string;
  topPick?: boolean;
  latitude?: number;
  longitude?: number;
  walkMinutes?: number;
  driveMinutes?: number;
  transitMinutes?: number;
}

export interface NearYouResultCacheEntry {
  results: NearYouCachedResult[];
  fetchedAt: string;
  contextLabel: string;
  aiPrompt?: string;
}

const PREFIX = 'travelhub-near-cache:';

/** Tool id or explore category key (e.g. explore:sights). */
function cacheKey(scope: string, toolId: string): string {
  return `${PREFIX}${scope}:${toolId}`;
}

export function loadNearYouCache(scope: string, toolId: string): NearYouResultCacheEntry | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = window.localStorage.getItem(cacheKey(scope, toolId));
    if (!raw) return null;
    const parsed = JSON.parse(raw) as NearYouResultCacheEntry;
    if (!Array.isArray(parsed.results)) return null;
    return parsed;
  } catch {
    return null;
  }
}

export function saveNearYouCache(
  scope: string,
  toolId: string,
  entry: NearYouResultCacheEntry
): void {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(cacheKey(scope, toolId), JSON.stringify(entry));
  } catch {
    // storage full or private mode
  }
}

export function nearYouScopeForHome(): string {
  return 'home-gps';
}

export function nearYouScopeForLocation(
  entryId: string,
  coords?: { lat: number; lng: number }
): string {
  if (
    coords &&
    Number.isFinite(coords.lat) &&
    Number.isFinite(coords.lng) &&
    Math.abs(coords.lat) <= 90 &&
    Math.abs(coords.lng) <= 180
  ) {
    // Include search centre so a new starting point does not reuse stale cached results.
    return `loc:${entryId}:${coords.lat.toFixed(4)},${coords.lng.toFixed(4)}`;
  }
  return `loc:${entryId}`;
}
