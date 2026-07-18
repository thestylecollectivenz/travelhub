import type { NearbyCategoryConfig } from './nearbyCategoryConfig';
import type { NearbyPlace } from './nearbyPlaceModel';
import { distanceMetresBetween, nearbyDirectionsUrl } from './nearbyPlaceModel';

/**
 * OpenStreetMap Overpass fallback — used only when Google returns fewer than
 * the category minimum. Conservative usage: single request per search, 10 s
 * timeout, session cache, and in-flight request dedupe.
 */

const OVERPASS_URL = 'https://overpass-api.de/api/interpreter';
const TIMEOUT_MS = 10000;

interface OverpassElement {
  type: 'node' | 'way' | 'relation';
  id: number;
  lat?: number;
  lon?: number;
  center?: { lat: number; lon: number };
  tags?: Record<string, string>;
}

const sessionCache = new Map<string, NearbyPlace[]>();
const inFlight = new Map<string, Promise<NearbyPlace[]>>();

function buildQuery(originLat: number, originLng: number, config: NearbyCategoryConfig): string {
  const around = `(around:${config.defaultRadiusMetres},${originLat},${originLng})`;
  const selectors = config.osmTags
    .map((tags) => {
      const filter = Object.keys(tags)
        .map((k) => `["${k}"="${tags[k]}"]`)
        .join('');
      return `node${filter}${around};way${filter}${around};`;
    })
    .join('');
  return `[out:json][timeout:10];(${selectors});out center ${config.maximumResults * 3};`;
}

function osmAddress(tags: Record<string, string>): string | undefined {
  const parts = [
    [tags['addr:housenumber'], tags['addr:street']].filter(Boolean).join(' '),
    tags['addr:city']
  ].filter(Boolean);
  return parts.length ? parts.join(', ') : undefined;
}

function toNearbyPlace(
  el: OverpassElement,
  originLat: number,
  originLng: number,
  categoryId: string
): NearbyPlace | null {
  const tags = el.tags || {};
  const name = (tags.name || '').trim();
  const lat = el.lat ?? el.center?.lat;
  const lng = el.lon ?? el.center?.lon;
  if (!name || !Number.isFinite(Number(lat)) || !Number.isFinite(Number(lng))) return null;
  const latitude = Number(lat);
  const longitude = Number(lng);
  const website = (tags.website || tags['contact:website'] || '').trim() || undefined;
  return {
    id: `osm:${el.type}:${el.id}`,
    source: 'openstreetmap',
    sourcePlaceId: `osm:${el.type}:${el.id}`,
    name,
    categoryId,
    primaryType: tags.amenity || tags.shop || tags.tourism || tags.leisure,
    address: osmAddress(tags),
    latitude,
    longitude,
    distanceMetres: distanceMetresBetween(originLat, originLng, latitude, longitude),
    websiteUrl: website && /^https?:\/\//i.test(website) ? website : undefined,
    phoneNumber: (tags.phone || tags['contact:phone'] || '').trim() || undefined,
    directionsUrl: nearbyDirectionsUrl(originLat, originLng, latitude, longitude),
    lastVerifiedAt: new Date().toISOString()
  };
}

export async function overpassNearbySearch(options: {
  originLat: number;
  originLng: number;
  config: NearbyCategoryConfig;
}): Promise<NearbyPlace[]> {
  const { originLat, originLng, config } = options;
  if (!config.osmTags.length) return [];
  const cacheKey = `${originLat.toFixed(5)}:${originLng.toFixed(5)}:${config.id}`;
  const cached = sessionCache.get(cacheKey);
  if (cached) return cached;
  const pending = inFlight.get(cacheKey);
  if (pending) return pending;

  const run = (async (): Promise<NearbyPlace[]> => {
    const controller = typeof AbortController !== 'undefined' ? new AbortController() : undefined;
    const timer = window.setTimeout(() => controller?.abort(), TIMEOUT_MS);
    try {
      const res = await fetch(OVERPASS_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: `data=${encodeURIComponent(buildQuery(originLat, originLng, config))}`,
        signal: controller?.signal
      });
      if (!res.ok) return [];
      const data = (await res.json()) as { elements?: OverpassElement[] };
      const places: NearbyPlace[] = [];
      for (const el of data.elements || []) {
        const place = toNearbyPlace(el, originLat, originLng, config.id);
        if (place) places.push(place);
      }
      sessionCache.set(cacheKey, places);
      return places;
    } catch {
      return [];
    } finally {
      window.clearTimeout(timer);
      inFlight.delete(cacheKey);
    }
  })();

  inFlight.set(cacheKey, run);
  return run;
}
