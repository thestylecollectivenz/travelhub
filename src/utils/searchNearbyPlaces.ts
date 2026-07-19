/**
 * Factual nearby-place search orchestrator (Explore).
 *
 * Flow: validate → local L1 cache → SharePoint cache (unless forceRefresh) →
 * Google Places discovery → OSM Overpass fallback when short → dedupe/filter/rank →
 * Details enrichment for the final set only → save both caches → return.
 * A failed forced refresh falls back to previous cached results ("stale-fallback").
 */
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
import {
  enrichGooglePlaceDetails,
  googleNearbySearch,
  rememberSessionPhotoUrls
} from './googlePlacesNearbySearch';
import { overpassNearbySearch } from './overpassNearbySearch';
import { NearbySearchCacheService } from '../services/NearbySearchCacheService';
import { loadNearbyLocalCache, saveNearbyLocalCache } from './nearbyLocalCache';

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

function googleStatusHint(status: string | undefined): string | undefined {
  if (!status) return undefined;
  if (status === 'KEY_CHANGED_RELOAD_NEEDED') {
    return 'The Google Maps key was changed after this page loaded. Fully reload the app to use the new key.';
  }
  if (status === 'AUTH_FAILURE') {
    return (
      'Google rejected the API key for this site (AUTH_FAILURE). The key works elsewhere, so check its ' +
      'Website restrictions in Google Cloud Console — they must include https://*.sharepoint.com/* (or be unrestricted).'
    );
  }
  if (status === 'REQUEST_DENIED') {
    return (
      'Google Places returned REQUEST_DENIED. Check Google Cloud Console: Places API enabled, billing active, ' +
      'and the key\u2019s Website restrictions include this SharePoint domain.'
    );
  }
  if (status === 'MAPS_JS_BLOCKED') {
    return (
      'The Google Maps script was blocked on this device (a Safari content blocker, Lockdown Mode, or a network ' +
      'filter blocking maps.googleapis.com). Tap refresh to retry, or check Safari settings for this site.'
    );
  }
  if (status === 'MAPS_JS_NOT_LOADED') {
    return 'The Google Maps script timed out loading. Tap the refresh icon to retry — it will reload the script.';
  }
  if (status === 'OVER_QUERY_LIMIT') {
    return 'Google Places quota exceeded for now. Showing OpenStreetMap results where available.';
  }
  return `Google Places returned ${status}.`;
}

/** When Google errored, cache OSM-only results briefly so it self-heals once the key works. */
const DEGRADED_CACHE_TTL_MS = 60 * 60 * 1000;

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
      forceRefresh = false;
    } else {
      lastForcedRefreshAt.set(flightKey, Date.now());
    }
  }

  const pending = inFlight.get(flightKey);
  if (pending && !forceRefresh) return pending;

  const cacheService = new NearbySearchCacheService(ctx);

  const run = (async (): Promise<NearbySearchResponse> => {
    // Instant device cache first (survives SharePoint latency and remounts).
    const local = !forceRefresh ? loadNearbyLocalCache(locationKey, categoryId) : undefined;
    if (local && isNearbyCacheValid(local)) {
      // Still try SharePoint in the background path below only when we miss —
      // for hits, return local immediately so reopen is never blank.
      return {
        results: local.results,
        cache: {
          status: 'hit',
          searchedAt: local.searchedAt,
          expiresAt: local.expiresAt
        }
      };
    }

    const cached = await cacheService.get(locationKey, categoryId);
    if (!forceRefresh && cached && isNearbyCacheValid(cached.payload)) {
      saveNearbyLocalCache(locationKey, categoryId, cached.payload);
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
      const google = googleMapsApiKey
        ? await googleNearbySearch({
            apiKey: googleMapsApiKey,
            originLat: originLatitude,
            originLng: originLongitude,
            config
          })
        : { places: [] as NearbyPlace[], errorStatus: 'NO_API_KEY' };

      let merged: NearbyPlace[] = dedupeNearbyPlaces(filterNearbyPlaces(google.places, config));

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

      const keyTail = googleMapsApiKey ? `…${googleMapsApiKey.slice(-6)}` : 'not set';
      if (!merged.length) {
        const hint = googleStatusHint(google.errorStatus);
        throw new Error(
          hint
            ? `${hint} (app is using key ending ${keyTail})`
            : 'No nearby places were returned by the search services.'
        );
      }

      let ranked = rankNearbyPlaces(merged, config);
      if (googleMapsApiKey) {
        ranked = await enrichGooglePlaceDetails(ranked, googleMapsApiKey);
      }
      // Photo URLs minted now stay valid all page-load — reuse them for free.
      rememberSessionPhotoUrls(ranked);

      const searchedAt = new Date().toISOString();
      const expiresAt = new Date(
        Date.now() +
          (google.errorStatus
            ? DEGRADED_CACHE_TTL_MS
            : config.cacheTtlDays * 24 * 60 * 60 * 1000)
      ).toISOString();
      const payload = {
        results: ranked,
        searchedAt,
        expiresAt,
        googleResultCount: google.places.length,
        osmResultCount: osmCount
      };
      saveNearbyLocalCache(locationKey, categoryId, payload);
      await cacheService.upsert(
        locationKey,
        categoryId,
        config.defaultRadiusMetres,
        { lat: originLatitude, lng: originLongitude },
        payload
      );

      const googleHint = googleStatusHint(google.errorStatus);
      return {
        results: ranked,
        cache: {
          status: forceRefresh ? 'refreshed' : 'miss',
          searchedAt,
          expiresAt
        },
        warning:
          googleHint && google.places.length === 0
            ? `${googleHint} (app is using key ending ${keyTail})`
            : undefined
      };
    } catch (err) {
      const fallback = cached?.payload.results.length
        ? cached.payload
        : loadNearbyLocalCache(locationKey, categoryId);
      if (fallback && fallback.results.length) {
        return {
          results: fallback.results,
          cache: {
            status: 'stale-fallback',
            searchedAt: fallback.searchedAt,
            expiresAt: fallback.expiresAt
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
