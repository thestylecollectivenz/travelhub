import { WebPartContext } from '@microsoft/sp-webpart-base';
import { ensureSharePointList } from './sharePointListProvisioning';

export const NEARBY_SEARCH_CACHE_LIST = 'NearbySearchCache';

/**
 * Shared cache of factual nearby-place search results (Google Places / OSM).
 * One row per location key + category + request version; shared by all
 * travellers so a place searched by one person is instant for the rest.
 */
export const NEARBY_SEARCH_CACHE_FIELDS = [
  { internalName: 'LocationKey', type: 'Text' as const },
  { internalName: 'CategoryId', type: 'Text' as const },
  { internalName: 'RadiusMetres', type: 'Number' as const },
  { internalName: 'OriginLat', type: 'Number' as const },
  { internalName: 'OriginLng', type: 'Number' as const },
  { internalName: 'ResultsJson', type: 'Note' as const },
  { internalName: 'SearchedAt', type: 'DateTime' as const },
  { internalName: 'ExpiresAt', type: 'DateTime' as const },
  { internalName: 'RequestVersion', type: 'Text' as const }
];

export async function ensureNearbySearchCacheList(ctx: WebPartContext): Promise<void> {
  await ensureSharePointList(ctx, NEARBY_SEARCH_CACHE_LIST, NEARBY_SEARCH_CACHE_FIELDS);
}
