import type { NearbyCategoryConfig } from './nearbyCategoryConfig';
import type { NearbyPlace } from './nearbyPlaceModel';
import {
  distanceMetresBetween,
  nearbyDirectionsUrl,
  nearbyMapsListingUrl
} from './nearbyPlaceModel';
import { loadGoogleMapsPlacesScript, lastMapsLoadFailure } from './googleMapsScriptLoader';

/**
 * Factual nearby search via the legacy Google Maps JS Places library.
 * The project already loads this library (see venueListingPhoto.ts), so we
 * intentionally stay on PlacesService rather than migrating to the new
 * Places API in this change.
 */

/* Minimal structural types for the legacy Places JS objects we consume. */
interface GmLatLng {
  lat: number | (() => number);
  lng: number | (() => number);
}

interface GmPhoto {
  getUrl: (opts: { maxWidth: number }) => string;
  html_attributions?: string[];
}

interface GmPlaceResult {
  place_id?: string;
  name?: string;
  vicinity?: string;
  formatted_address?: string;
  geometry?: { location?: GmLatLng };
  rating?: number;
  user_ratings_total?: number;
  business_status?: string;
  price_level?: number;
  types?: string[];
  photos?: GmPhoto[];
  website?: string;
  url?: string;
  international_phone_number?: string;
  opening_hours?: {
    weekday_text?: string[];
    isOpen?: () => boolean | undefined;
  };
}

interface GmPlacesService {
  nearbySearch: (
    req: { location: { lat: number; lng: number }; radius: number; type?: string; keyword?: string },
    cb: (results: GmPlaceResult[] | null, status: string) => void
  ) => void;
  textSearch: (
    req: { query: string; location: { lat: number; lng: number }; radius: number },
    cb: (results: GmPlaceResult[] | null, status: string) => void
  ) => void;
  getDetails: (
    req: { placeId: string; fields: string[] },
    cb: (result: GmPlaceResult | null, status: string) => void
  ) => void;
}

interface GmPlacesNamespace {
  PlacesService: new (el: HTMLElement) => GmPlacesService;
  PlacesServiceStatus: { OK: string; ZERO_RESULTS: string };
}

function placesNamespace(): GmPlacesNamespace | undefined {
  const w = window as unknown as { google?: { maps?: { places?: GmPlacesNamespace } } };
  return w.google?.maps?.places;
}

/**
 * Google calls window.gm_authFailure when the Maps JS key is rejected for this
 * page (invalid key, billing, or website/referrer restrictions blocking this
 * domain). Capture it so we can report the real reason instead of a generic one.
 */
let mapsAuthFailed = false;

function hookAuthFailure(): void {
  const w = window as unknown as { gm_authFailure?: () => void };
  if (w.gm_authFailure && (w.gm_authFailure as { thHooked?: boolean }).thHooked) return;
  const prev = w.gm_authFailure;
  const hooked = (): void => {
    mapsAuthFailed = true;
    // eslint-disable-next-line no-console
    console.warn('Google Maps rejected the API key for this page (gm_authFailure).');
    if (typeof prev === 'function') prev();
  };
  (hooked as { thHooked?: boolean }).thHooked = true;
  w.gm_authFailure = hooked;
}

export function googleMapsAuthFailed(): boolean {
  return mapsAuthFailed;
}

/**
 * The Maps script loads once per page with the key used first. If the user has
 * since saved a different key in settings, requests keep using the old one
 * until a full reload — detect that so the UI can say so.
 */
export function googleMapsScriptKeyMismatch(apiKey: string): boolean {
  const existing = document.querySelector<HTMLScriptElement>('script[data-th-google-places]');
  if (!existing?.src) return false;
  const match = existing.src.match(/[?&]key=([^&]+)/);
  if (!match) return false;
  try {
    return decodeURIComponent(match[1]) !== apiKey;
  } catch {
    return match[1] !== apiKey;
  }
}

/** Load the Maps JS Places library via the shared self-healing loader. */
export async function loadGooglePlacesLibrary(apiKey: string): Promise<GmPlacesNamespace | undefined> {
  hookAuthFailure();
  await loadGoogleMapsPlacesScript(apiKey);
  return placesNamespace();
}

function coordNumber(v: number | (() => number) | undefined): number {
  if (typeof v === 'function') return Number(v());
  return Number(v);
}

function priceLevelLabel(level: number | undefined): string | undefined {
  if (!Number.isFinite(Number(level))) return undefined;
  const n = Math.max(0, Math.min(4, Number(level)));
  return n > 0 ? '$'.repeat(n) : undefined;
}

function stripAttributionHtml(html: string | undefined): string | undefined {
  if (!html) return undefined;
  const text = html.replace(/<[^>]+>/g, '').trim();
  return text || undefined;
}

function toNearbyPlace(
  raw: GmPlaceResult,
  originLat: number,
  originLng: number,
  categoryId: string
): NearbyPlace | null {
  const placeId = (raw.place_id || '').trim();
  const name = (raw.name || '').trim();
  const lat = coordNumber(raw.geometry?.location?.lat);
  const lng = coordNumber(raw.geometry?.location?.lng);
  if (!placeId || !name || !Number.isFinite(lat) || !Number.isFinite(lng)) return null;
  const distanceMetres = distanceMetresBetween(originLat, originLng, lat, lng);
  const photo = raw.photos?.[0];
  let photoUrl: string | undefined;
  try {
    photoUrl = photo ? photo.getUrl({ maxWidth: 800 }) : undefined;
  } catch {
    photoUrl = undefined;
  }
  return {
    id: `g:${placeId}`,
    source: 'google',
    sourcePlaceId: placeId,
    name,
    categoryId,
    primaryType: raw.types?.[0],
    address: (raw.vicinity || raw.formatted_address || '').trim() || undefined,
    latitude: lat,
    longitude: lng,
    distanceMetres,
    rating: Number.isFinite(Number(raw.rating)) ? Number(raw.rating) : undefined,
    reviewCount: Number.isFinite(Number(raw.user_ratings_total))
      ? Number(raw.user_ratings_total)
      : undefined,
    businessStatus: raw.business_status,
    priceLevel: priceLevelLabel(raw.price_level),
    photoUrl,
    photoAttribution: stripAttributionHtml(photo?.html_attributions?.[0]),
    mapsUrl: nearbyMapsListingUrl(placeId, name, raw.vicinity),
    directionsUrl: nearbyDirectionsUrl(originLat, originLng, lat, lng, placeId),
    lastVerifiedAt: new Date().toISOString()
  };
}

interface SearchBatch {
  results: GmPlaceResult[];
  status: string;
}

function runNearbySearch(
  svc: GmPlacesService,
  ns: GmPlacesNamespace,
  req: { location: { lat: number; lng: number }; radius: number; type?: string; keyword?: string }
): Promise<SearchBatch> {
  return new Promise((resolve) => {
    const timeout = window.setTimeout(() => resolve({ results: [], status: 'TIMEOUT' }), 9000);
    try {
      svc.nearbySearch(req, (results, status) => {
        window.clearTimeout(timeout);
        resolve({
          results: status === ns.PlacesServiceStatus.OK && results ? results : [],
          status
        });
      });
    } catch {
      window.clearTimeout(timeout);
      resolve({ results: [], status: 'EXCEPTION' });
    }
  });
}

function runTextSearch(
  svc: GmPlacesService,
  ns: GmPlacesNamespace,
  req: { query: string; location: { lat: number; lng: number }; radius: number }
): Promise<SearchBatch> {
  return new Promise((resolve) => {
    const timeout = window.setTimeout(() => resolve({ results: [], status: 'TIMEOUT' }), 9000);
    try {
      svc.textSearch(req, (results, status) => {
        window.clearTimeout(timeout);
        resolve({
          results: status === ns.PlacesServiceStatus.OK && results ? results : [],
          status
        });
      });
    } catch {
      window.clearTimeout(timeout);
      resolve({ results: [], status: 'EXCEPTION' });
    }
  });
}

export interface GoogleNearbySearchResult {
  places: NearbyPlace[];
  /**
   * Set when Google returned no places because of an error (REQUEST_DENIED,
   * OVER_QUERY_LIMIT, …) rather than a genuine lack of venues. Lets the UI
   * tell the user their Google key needs fixing instead of failing silently.
   */
  errorStatus?: string;
}

/**
 * Discovery: nearbySearch per configured type + textSearch per configured query.
 * Only cheap identification fields are used here; expensive Details fields are
 * fetched later for the final displayed results only.
 */
export async function googleNearbySearch(options: {
  apiKey: string;
  originLat: number;
  originLng: number;
  config: NearbyCategoryConfig;
}): Promise<GoogleNearbySearchResult> {
  const { apiKey, originLat, originLng, config } = options;
  const ns = await loadGooglePlacesLibrary(apiKey);
  if (!ns) {
    if (mapsAuthFailed) return { places: [], errorStatus: 'AUTH_FAILURE' };
    return {
      places: [],
      errorStatus: lastMapsLoadFailure() === 'script-error' ? 'MAPS_JS_BLOCKED' : 'MAPS_JS_NOT_LOADED'
    };
  }
  const host = document.createElement('div');
  const svc = new ns.PlacesService(host);
  const location = { lat: originLat, lng: originLng };
  const radius = config.defaultRadiusMetres;

  const batches: SearchBatch[] = [];
  // Sequential requests keep us well inside Places JS rate limits.
  for (const type of config.googleTypes) {
    // eslint-disable-next-line no-await-in-loop
    batches.push(await runNearbySearch(svc, ns, { location, radius, type }));
  }
  for (const query of config.googleTextQueries) {
    // eslint-disable-next-line no-await-in-loop
    batches.push(await runTextSearch(svc, ns, { query, location, radius }));
  }

  const excludedPrimary = config.googleExcludedPrimaryTypes || [];
  const places: NearbyPlace[] = [];
  for (const batch of batches) {
    for (const raw of batch.results) {
      const primaryType = raw.types?.[0] || '';
      if (primaryType && excludedPrimary.indexOf(primaryType) !== -1) continue;
      const place = toNearbyPlace(raw, originLat, originLng, config.id);
      if (place) places.push(place);
    }
  }

  let errorStatus: string | undefined;
  if (!places.length) {
    if (googleMapsScriptKeyMismatch(apiKey)) {
      errorStatus = 'KEY_CHANGED_RELOAD_NEEDED';
    } else if (mapsAuthFailed) {
      errorStatus = 'AUTH_FAILURE';
    } else {
      const failing = batches.find(
        (b) => b.status !== ns.PlacesServiceStatus.OK && b.status !== ns.PlacesServiceStatus.ZERO_RESULTS
      );
      errorStatus = failing?.status;
    }
  }
  return { places, errorStatus };
}

/**
 * Photo URLs returned by the Places JS library embed short-lived session
 * tokens, so URLs stored in the cache stop loading after a page reload (red-X
 * images on reopen). Re-resolve photos for cached Google places via a cheap
 * photos-only Details call before display.
 */
export async function refreshGooglePlacePhotos(
  places: NearbyPlace[],
  apiKey: string
): Promise<NearbyPlace[]> {
  const ns = await loadGooglePlacesLibrary(apiKey);
  if (!ns) return places;
  const host = document.createElement('div');
  const svc = new ns.PlacesService(host);

  const refreshOne = (place: NearbyPlace): Promise<NearbyPlace> =>
    new Promise((resolve) => {
      if (place.source !== 'google') {
        resolve(place);
        return;
      }
      const timeout = window.setTimeout(() => resolve({ ...place, photoUrl: undefined }), 5000);
      try {
        svc.getDetails({ placeId: place.sourcePlaceId, fields: ['photos'] }, (detail, status) => {
          window.clearTimeout(timeout);
          if (status !== ns.PlacesServiceStatus.OK || !detail) {
            // The stored URL is dead — no image beats a broken one.
            resolve({ ...place, photoUrl: undefined });
            return;
          }
          const photo = detail.photos?.[0];
          let photoUrl: string | undefined;
          try {
            photoUrl = photo ? photo.getUrl({ maxWidth: 800 }) : undefined;
          } catch {
            photoUrl = undefined;
          }
          resolve({
            ...place,
            photoUrl,
            photoAttribution: stripAttributionHtml(photo?.html_attributions?.[0]) || place.photoAttribution
          });
        });
      } catch {
        window.clearTimeout(timeout);
        resolve({ ...place, photoUrl: undefined });
      }
    });

  const out: NearbyPlace[] = [];
  for (const place of places) {
    // eslint-disable-next-line no-await-in-loop
    out.push(await refreshOne(place));
  }
  return out;
}

const DETAIL_FIELDS = [
  'place_id',
  'website',
  'url',
  'formatted_address',
  'international_phone_number',
  'opening_hours',
  'utc_offset_minutes'
];

/**
 * Enrich only the final displayed Google results with Details fields
 * (website, maps URI, opening hours). Strict field mask per call.
 */
export async function enrichGooglePlaceDetails(
  places: NearbyPlace[],
  apiKey: string
): Promise<NearbyPlace[]> {
  const ns = await loadGooglePlacesLibrary(apiKey);
  if (!ns) return places;
  const host = document.createElement('div');
  const svc = new ns.PlacesService(host);

  const enrichOne = (place: NearbyPlace): Promise<NearbyPlace> =>
    new Promise((resolve) => {
      if (place.source !== 'google') {
        resolve(place);
        return;
      }
      const timeout = window.setTimeout(() => resolve(place), 6000);
      try {
        svc.getDetails({ placeId: place.sourcePlaceId, fields: DETAIL_FIELDS }, (detail, status) => {
          window.clearTimeout(timeout);
          if (status !== ns.PlacesServiceStatus.OK || !detail) {
            resolve(place);
            return;
          }
          let isOpenNow: boolean | undefined;
          try {
            isOpenNow = detail.opening_hours?.isOpen ? detail.opening_hours.isOpen() : undefined;
          } catch {
            isOpenNow = undefined;
          }
          resolve({
            ...place,
            websiteUrl: (detail.website || '').trim() || place.websiteUrl,
            mapsUrl: (detail.url || '').trim() || place.mapsUrl,
            address: (detail.formatted_address || '').trim() || place.address,
            phoneNumber: (detail.international_phone_number || '').trim() || place.phoneNumber,
            openingHours: detail.opening_hours?.weekday_text?.length
              ? detail.opening_hours.weekday_text
              : place.openingHours,
            isOpenNow: typeof isOpenNow === 'boolean' ? isOpenNow : place.isOpenNow
          });
        });
      } catch {
        window.clearTimeout(timeout);
        resolve(place);
      }
    });

  const out: NearbyPlace[] = [];
  for (const place of places) {
    // eslint-disable-next-line no-await-in-loop
    out.push(await enrichOne(place));
  }
  return out;
}
