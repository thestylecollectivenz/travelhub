import type { NearbySearchCachePayload } from './nearbyPlaceModel';
import { isNearbyCacheValid, NEARBY_CACHE_REQUEST_VERSION } from './nearbyPlaceModel';

/**
 * Instant device-local mirror of nearby search results.
 * SharePoint remains the shared source of truth; this L1 cache makes reopen
 * feel instant and survives SharePoint list latency / permission blips.
 */
const PREFIX = 'travelhub-nearby-l1:';

function key(locationKey: string, categoryId: string): string {
  return `${PREFIX}${NEARBY_CACHE_REQUEST_VERSION}:${locationKey}:${categoryId}`;
}

export function loadNearbyLocalCache(
  locationKey: string,
  categoryId: string
): NearbySearchCachePayload | undefined {
  if (typeof window === 'undefined') return undefined;
  try {
    const raw = window.localStorage.getItem(key(locationKey, categoryId));
    if (!raw) return undefined;
    const parsed = JSON.parse(raw) as NearbySearchCachePayload;
    if (!isNearbyCacheValid(parsed)) return undefined;
    return parsed;
  } catch {
    return undefined;
  }
}

export function saveNearbyLocalCache(
  locationKey: string,
  categoryId: string,
  payload: NearbySearchCachePayload
): void {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(key(locationKey, categoryId), JSON.stringify(payload));
  } catch {
    /* storage full / private mode */
  }
}
