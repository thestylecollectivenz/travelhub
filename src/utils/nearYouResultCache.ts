import type { NearYouToolId } from './nearYouTools';

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
}

export interface NearYouResultCacheEntry {
  results: NearYouCachedResult[];
  fetchedAt: string;
  contextLabel: string;
  aiPrompt?: string;
}

const PREFIX = 'travelhub-near-cache:';

function cacheKey(scope: string, toolId: NearYouToolId): string {
  return `${PREFIX}${scope}:${toolId}`;
}

export function loadNearYouCache(scope: string, toolId: NearYouToolId): NearYouResultCacheEntry | null {
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
  toolId: NearYouToolId,
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

export function nearYouScopeForLocation(entryId: string): string {
  return `loc:${entryId}`;
}
