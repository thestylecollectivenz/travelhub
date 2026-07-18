import type { WebPartContext } from '@microsoft/sp-webpart-base';
import type { ExploreCategoryId } from './exploreCategories';
import { nearbyCategoryConfig } from './nearbyCategoryConfig';
import type { NearbyPlace, NearbySearchResponse } from './nearbyPlaceModel';
import {
  dedupeNearbyPlaces,
  filterNearbyPlaces,
  isNearbyCacheValid,
  nearbyLocationKey,
  rankNearbyPlaces
} from './nearbyPlaceModel';
import { enrichGooglePlaceDetails, googleNearbySearch } from './googlePlacesNearbySearch';
import { overpassNearbySearch } from './overpassNearbySearch';
import { NearbySearchCacheService } from '../services/NearbySearchCacheService';

/**
 * Factual nearby-place search orchestrator (Explore).
 *
 * Flow: validate → cache (unless forceRefresh) → Google Places discovery →
 * OSM Overpass fallback when short → dedupe/filter/rank → Details enrichment
 * for the final set only → save cache → return with cache metadata.
 * A failed forced refresh falls back to the previous cached results
 * ("stale-fallback") and never deletes the cache.
 */
export interface SearchNearbyPlacesOptions {
  ctx: WebPartContext;
  googleMapsApiKey: string;
  originLatitude: number;
  originLongitude: number;
  categoryId: ExploreCategoryId;
  forceRefresh?: boolean;
  /** Saved location-info entry id, for a stable shared cache key. */
  locationEntryId?: string;
}

/** Prevent duplicate concurrent live searches for the same origin + category. */
const inFlight = new Map<string, Promise<NearbySearchResponse>>();

/** Refresh rate limit: min interval per origin + category. */
const lastForcedRefreshAt = new Map<string, number>();
const FORCE_REFRESH_MIN_INTERVAL_MS = 30000;

function isValidLatLng(lat: number, lng: number): boolean {
  return Number.isFinite(lat) && Number.isFinite(lng) && Math.abs(lat) <= 90 && Math.abs(lng) <= 180;
}

export async function searchNearbyPlaces(options: SearchNearbyPlacesOptions): Promise<NearbySearchResponse> {
  const { ctx, googleMapsApiKey, originLatitude, originLongitude, categoryId, locationEntryId } = options;
  if (!isValidLatLng(originLatitude, originLongitude)) {
    throw new Error('A valid search location is required.');
  }
  const config = nearbyCategoryConfig(categoryId);
  if (!config) {
    throw new Error(`Unknown nearby category: ${categoryId}`);
  }

  const locationKey = nearbyLocationKey(originLatitude, originLongitude, locationEntryId);
  const flightKey = `${locationKey}:${categoryId}`;
  let forceRefresh = options.forceRefresh === true;

  if (forceRefresh) {
    const last = lastForcedRefreshAt.get(flightKey) || 0;
    if (Date.now() - last < FORCE_REFRESH_MIN_INTERVAL_MS) {
      // Double-tap protection: treat as a normal cached request.
      forceRefresh = false;
    } else {
      lastForcedRefreshAt.set(flightKey, Date.now());
    }
  }

  // A request may wait for an identical in-progress search and reuse its result.
  const pending = inFlight.get(flightKey);
  if (pending && !forceRefresh) return pending;

  const cacheService = new NearbySearchCacheService(ctx);

  const run = (async (): Promise<NearbySearchResponse> => {
    const cached = await cacheService.get(locationKey, categoryId);

    if (!forceRefresh && cached && isNearbyCacheValid(cached.payload)) {
      return {
        results: cached.payload.results,
        cache: {
          status: 'hit',
          searchedAt: cached.payload.searchedAt,
          expiresAt: cached.payload.expiresAt
        }
      };
    }

    try {
      const googleResults = googleMapsApiKey
        ? await googleNearbySearch({
            apiKey: googleMapsApiKey,
            originLat: originLatitude,
            originLng: originLongitude,
            config
          })
        : [];

      let merged: NearbyPlace[] = dedupeNearbyPlaces(filterNearbyPlaces(googleResults, config));

      let osmCount = 0;
      if (merged.length < config.minimumResults) {
        const osmResults = await overpassNearbySearch({
          originLat: originLatitude,
          originLng: originLongitude,
          config
        });
        osmCount = osmResults.length;
        merged = dedupeNearbyPlaces(filterNearbyPlaces([...merged, ...osmResults], config));
      }

      if (!merged.length) {
        throw new Error('No nearby places were returned by the search services.');
      }

      let ranked = rankNearbyPlaces(merged, config);
      if (googleMapsApiKey) {
        ranked = await enrichGooglePlaceDetails(ranked, googleMapsApiKey);
      }

      const searchedAt = new Date().toISOString();
      const expiresAt = new Date(Date.now() + config.cacheTtlDays * 24 * 60 * 60 * 1000).toISOString();
      const payload = {
        results: ranked,
        searchedAt,
        expiresAt,
        googleResultCount: googleResults.length,
        osmResultCount: osmCount
      };
      // Persist for every traveller on the trip; failure to save never blocks results.
      await cacheService.upsert(
        locationKey,
        categoryId,
        config.defaultRadiusMetres,
        { lat: originLatitude, lng: originLongitude },
        payload
      );

      return {
        results: ranked,
        cache: {
          status: forceRefresh ? 'refreshed' : 'miss',
          searchedAt,
          expiresAt
        }
      };
    } catch (err) {
      // Live search failed: keep and return previous cached results if any.
      if (cached && cached.payload.results.length) {
        return {
          results: cached.payload.results,
          cache: {
            status: 'stale-fallback',
            searchedAt: cached.payload.searchedAt,
            expiresAt: cached.payload.expiresAt
          },
          warning: 'We could not update nearby places just now. Showing the previous results.'
        };
      }
      throw err instanceof Error ? err : new Error('Nearby search failed.');
    }
  })();

  inFlight.set(flightKey, run);
  try {
    return await run;
  } finally {
    inFlight.delete(flightKey);
  }
}
