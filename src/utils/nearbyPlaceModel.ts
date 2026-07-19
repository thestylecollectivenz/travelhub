import { haversineKm } from './distanceUtils';
import type { NearbyCategoryConfig } from './nearbyCategoryConfig';

/** Normalised factual nearby place (Google Places or OpenStreetMap — never Gemini). */
export interface NearbyPlace {
  /** Stable Travel Hub id, e.g. `g:{placeId}` or `osm:node:123`. */
  id: string;
  source: 'google' | 'openstreetmap';
  sourcePlaceId: string;
  name: string;
  categoryId: string;
  primaryType?: string;
  address?: string;
  latitude: number;
  longitude: number;
  distanceMetres: number;
  rating?: number;
  reviewCount?: number;
  businessStatus?: string;
  isOpenNow?: boolean;
  openingHours?: string[];
  websiteUrl?: string;
  mapsUrl?: string;
  directionsUrl: string;
  phoneNumber?: string;
  priceLevel?: string;
  photoUrl?: string;
  photoAttribution?: string;
  lastVerifiedAt: string;
}

export interface NearbySearchCachePayload {
  results: NearbyPlace[];
  searchedAt: string;
  expiresAt: string;
  googleResultCount: number;
  osmResultCount: number;
}

export type NearbyCacheStatus = 'hit' | 'miss' | 'refreshed' | 'stale-fallback';

export interface NearbySearchResponse {
  results: NearbyPlace[];
  cache: {
    status: NearbyCacheStatus;
    searchedAt: string;
    expiresAt: string;
  };
  warning?: string;
}

/* ------------------------------------------------------------------ */
/* Distance                                                            */
/* ------------------------------------------------------------------ */

export function distanceMetresBetween(
  originLat: number,
  originLng: number,
  lat: number,
  lng: number
): number {
  return Math.round(haversineKm(originLat, originLng, lat, lng) * 1000);
}

/** "350 m" below 1 km, "1.4 km" above. */
export function formatDistanceMetres(metres: number): string {
  if (!Number.isFinite(metres) || metres < 0) return '';
  if (metres < 1000) return `${Math.round(metres)} m`;
  return `${(metres / 1000).toFixed(1)} km`;
}

/**
 * Deterministic walk estimate calibrated against Google walking directions in
 * town centres: street routes run ~1.35× the straight line at ~75 m/min.
 */
export function estimateWalkMinutesFromMetres(metres: number): number | undefined {
  if (!Number.isFinite(metres) || metres <= 0) return undefined;
  const mins = Math.max(1, Math.round((metres * 1.35) / 75));
  return mins <= 180 ? mins : undefined;
}

/**
 * Drive estimate: ~1.4× route factor at ~26 km/h urban average, plus ~1.5 min
 * of start/park overhead — Google rarely reports “1 min” drives in town.
 */
export function estimateDriveMinutesFromMetres(metres: number): number | undefined {
  if (!Number.isFinite(metres) || metres <= 50) return undefined;
  const routeKm = (metres / 1000) * 1.4;
  const mins = Math.max(2, Math.round(1.5 + (routeKm * 60) / 26));
  return mins <= 180 ? mins : undefined;
}

/* ------------------------------------------------------------------ */
/* URLs                                                                */
/* ------------------------------------------------------------------ */

/** Google Maps directions URL; includes destination_place_id for Google results. */
export function nearbyDirectionsUrl(
  originLat: number,
  originLng: number,
  destLat: number,
  destLng: number,
  googlePlaceId?: string,
  travelMode: 'walking' | 'driving' | 'transit' = 'walking'
): string {
  const base =
    `https://www.google.com/maps/dir/?api=1` +
    `&origin=${encodeURIComponent(`${originLat},${originLng}`)}` +
    `&destination=${encodeURIComponent(`${destLat},${destLng}`)}`;
  const placeParam = googlePlaceId
    ? `&destination_place_id=${encodeURIComponent(googlePlaceId)}`
    : '';
  return `${base}${placeParam}&travelmode=${travelMode}`;
}

/** Google Maps listing URL from a Place ID (used when Details did not supply a maps URI). */
export function nearbyMapsListingUrl(placeId: string | undefined, name: string, address?: string): string {
  if (placeId) {
    const q = encodeURIComponent(name || 'place');
    return `https://www.google.com/maps/search/?api=1&query=${q}&query_place_id=${encodeURIComponent(placeId)}`;
  }
  const q = [name, address].filter(Boolean).join(', ');
  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(q)}`;
}

/* ------------------------------------------------------------------ */
/* Deduplication                                                       */
/* ------------------------------------------------------------------ */

/** Lowercase, strip accents/punctuation/legal suffixes, collapse whitespace. */
export function normalizePlaceName(name: string): string {
  let text = (name || '').toLowerCase();
  // NFD + strip combining marks so "Café" matches "Cafe".
  if (typeof text.normalize === 'function') {
    text = text.normalize('NFD').replace(/[\u0300-\u036f]/g, '');
  }
  return text
    .replace(/\b(ltd|limited|gmbh|s\.?a\.?r\.?l\.?|b\.?v\.?|inc|llc|as|ab)\b\.?/g, ' ')
    .replace(/[!-/:-@[-`{-~]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

const CROSS_SOURCE_DUP_METRES = 40;

/**
 * Dedupe rules:
 * - identical source ids are duplicates;
 * - cross-source: highly similar normalised names within ~40 m — prefer Google;
 * - separate branches of the same chain (further apart) are kept.
 */
export function dedupeNearbyPlaces(places: NearbyPlace[]): NearbyPlace[] {
  const out: NearbyPlace[] = [];
  for (const candidate of places) {
    let duplicateIdx = -1;
    for (let i = 0; i < out.length; i++) {
      const kept = out[i];
      if (kept.source === candidate.source && kept.sourcePlaceId === candidate.sourcePlaceId) {
        duplicateIdx = i;
        break;
      }
      const nameA = normalizePlaceName(kept.name);
      const nameB = normalizePlaceName(candidate.name);
      if (!nameA || !nameB) continue;
      const namesMatch = nameA === nameB || nameA.indexOf(nameB) === 0 || nameB.indexOf(nameA) === 0;
      if (!namesMatch) continue;
      const metres = distanceMetresBetween(
        kept.latitude,
        kept.longitude,
        candidate.latitude,
        candidate.longitude
      );
      if (metres <= CROSS_SOURCE_DUP_METRES) {
        duplicateIdx = i;
        break;
      }
    }
    if (duplicateIdx < 0) {
      out.push(candidate);
      continue;
    }
    // Prefer the Google version of a cross-source duplicate.
    if (out[duplicateIdx].source !== 'google' && candidate.source === 'google') {
      out[duplicateIdx] = candidate;
    }
  }
  return out;
}

/* ------------------------------------------------------------------ */
/* Filtering                                                           */
/* ------------------------------------------------------------------ */

export function filterNearbyPlaces(places: NearbyPlace[], config: NearbyCategoryConfig): NearbyPlace[] {
  // Well outside radius = 1.5× the configured search radius.
  const maxMetres = config.defaultRadiusMetres * 1.5;
  return places.filter((p) => {
    if (!p.name.trim()) return false;
    if (!Number.isFinite(p.latitude) || !Number.isFinite(p.longitude)) return false;
    if ((p.businessStatus || '').toUpperCase() === 'CLOSED_PERMANENTLY') return false;
    if (p.distanceMetres > maxMetres) return false;
    return true;
  });
}

/* ------------------------------------------------------------------ */
/* Ranking                                                             */
/* ------------------------------------------------------------------ */

/** Ranking weights — documented constants so tuning is easy. */
export const NEARBY_RANK_WEIGHTS = {
  /** Max points for being right at the origin, linearly falling to 0 at the radius. */
  distance: 40,
  /** Confidence-adjusted rating (Bayesian-style shrink towards 3.5 with few reviews). */
  rating: 30,
  /** Log-scaled review-count bonus, capped. */
  reviews: 15,
  openNow: 4,
  website: 3,
  photo: 3,
  /** Google results carry richer verified data than OSM fallbacks. */
  googleSource: 5
};

const RATING_PRIOR = 3.5;
const RATING_PRIOR_WEIGHT = 25;

/** Confidence-adjusted rating: 5.0×2 reviews must not outrank 4.7×1000. */
export function confidenceAdjustedRating(rating: number | undefined, reviewCount: number | undefined): number {
  const r = Number.isFinite(Number(rating)) ? Number(rating) : 0;
  const n = Number.isFinite(Number(reviewCount)) ? Math.max(0, Number(reviewCount)) : 0;
  if (r <= 0) return RATING_PRIOR;
  return (r * n + RATING_PRIOR * RATING_PRIOR_WEIGHT) / (n + RATING_PRIOR_WEIGHT);
}

export function nearbyPlaceScore(place: NearbyPlace, config: NearbyCategoryConfig): number {
  const w = NEARBY_RANK_WEIGHTS;
  const distanceScore =
    w.distance * Math.max(0, 1 - place.distanceMetres / Math.max(1, config.defaultRadiusMetres));
  const ratingScore = (confidenceAdjustedRating(place.rating, place.reviewCount) / 5) * w.rating;
  const reviews = Math.max(0, Number(place.reviewCount) || 0);
  const reviewScore = Math.min(1, Math.log10(1 + reviews) / 3) * w.reviews;
  const openBonus = place.isOpenNow === true ? w.openNow : 0;
  const websiteBonus = place.websiteUrl ? w.website : 0;
  const photoBonus = place.photoUrl ? w.photo : 0;
  const sourceBonus = place.source === 'google' ? w.googleSource : 0;
  return distanceScore + ratingScore + reviewScore + openBonus + websiteBonus + photoBonus + sourceBonus;
}

/** Deterministic ranking; ties broken by distance then name. */
export function rankNearbyPlaces(places: NearbyPlace[], config: NearbyCategoryConfig): NearbyPlace[] {
  return places
    .slice()
    .sort((a, b) => {
      const diff = nearbyPlaceScore(b, config) - nearbyPlaceScore(a, config);
      if (Math.abs(diff) > 1e-9) return diff;
      if (a.distanceMetres !== b.distanceMetres) return a.distanceMetres - b.distanceMetres;
      return a.name.localeCompare(b.name);
    })
    .slice(0, config.maximumResults);
}

/* ------------------------------------------------------------------ */
/* Cache validity                                                      */
/* ------------------------------------------------------------------ */

export const NEARBY_CACHE_REQUEST_VERSION = 'v3';

export function isNearbyCacheValid(
  payload: Pick<NearbySearchCachePayload, 'expiresAt' | 'results'> | undefined,
  now: Date = new Date()
): boolean {
  if (!payload || !Array.isArray(payload.results) || !payload.results.length) return false;
  const expires = Date.parse(payload.expiresAt || '');
  return Number.isFinite(expires) && expires > now.getTime();
}

/** Stable cache key for a search origin (5-decimal ≈ 1 m precision, per brief). */
export function nearbyLocationKey(
  originLat: number,
  originLng: number,
  locationEntryId?: string
): string {
  const coords = `${originLat.toFixed(5)}:${originLng.toFixed(5)}`;
  return locationEntryId ? `location:${locationEntryId}:${coords}` : `coordinates:${coords}`;
}
