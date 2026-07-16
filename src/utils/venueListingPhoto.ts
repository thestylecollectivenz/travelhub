import type { ResolvedPlacePhoto } from './placePhotoResolve';
import { reverseGeocodeAddress } from './googlePlacePhoto';

type CacheRow = Record<string, ResolvedPlacePhoto>;
const CACHE_KEY = 'travelhub-venue-photos-v3';

function loadCache(): CacheRow {
  try {
    const raw = window.sessionStorage.getItem(CACHE_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw) as unknown;
    return parsed && typeof parsed === 'object' ? (parsed as CacheRow) : {};
  } catch {
    return {};
  }
}

function saveCache(row: CacheRow): void {
  try {
    window.sessionStorage.setItem(CACHE_KEY, JSON.stringify(row));
  } catch {
    /* ignore */
  }
}

/** Always a place listing / search pin — never /dir/ directions. */
function mapsListingUrl(name: string, address?: string, lat?: number, lng?: number, placeId?: string): string {
  if (placeId) {
    return `https://www.google.com/maps/search/?api=1&query_place_id=${encodeURIComponent(placeId)}`;
  }
  if ((address || '').trim()) {
    return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(address!.trim())}`;
  }
  if (Number.isFinite(lat) && Number.isFinite(lng)) {
    return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(`${lat},${lng}`)}`;
  }
  const q = [name, address].filter(Boolean).join(', ');
  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(q)}`;
}

async function commonsNearCoords(lat: number, lng: number): Promise<{ imageUrl: string } | null> {
  const url =
    `https://commons.wikimedia.org/w/api.php?action=query&list=geosearch` +
    `&gscoord=${lat}|${lng}&gsradius=120&gslimit=8&gsnamespace=6&format=json&origin=*`;
  try {
    const res = await fetch(url);
    if (!res.ok) return null;
    const data = (await res.json()) as { query?: { geosearch?: Array<{ title?: string; pageid?: number }> } };
    const hits = data.query?.geosearch || [];
    for (const hit of hits) {
      if (!hit.title || !hit.pageid) continue;
      const infoUrl =
        `https://commons.wikimedia.org/w/api.php?action=query&pageids=${hit.pageid}` +
        `&prop=imageinfo&iiprop=url|mime&iiurlwidth=800&format=json&origin=*`;
      const infoRes = await fetch(infoUrl);
      if (!infoRes.ok) continue;
      const infoData = (await infoRes.json()) as {
        query?: {
          pages?: Record<
            string,
            { imageinfo?: Array<{ thumburl?: string; url?: string; mime?: string }> }
          >;
        };
      };
      const info = Object.values(infoData.query?.pages || {})[0]?.imageinfo?.[0];
      if (!info || (info.mime && !info.mime.startsWith('image/'))) continue;
      const imageUrl = info.thumburl || info.url;
      if (!imageUrl) continue;
      return { imageUrl };
    }
  } catch {
    /* ignore */
  }
  return null;
}

async function openversePhoto(name: string, city?: string): Promise<{ imageUrl: string } | null> {
  const q = [name, city].filter(Boolean).join(' ').trim();
  if (!q) return null;
  try {
    const url = `https://api.openverse.org/v1/images/?q=${encodeURIComponent(q)}&page_size=5`;
    const res = await fetch(url, { headers: { Accept: 'application/json' } });
    if (!res.ok) return null;
    const data = (await res.json()) as {
      results?: Array<{ url?: string; title?: string }>;
    };
    for (const row of data.results || []) {
      if (!row.url) continue;
      const title = (row.title || '').toLowerCase();
      const needle = name.trim().toLowerCase();
      if (needle.length >= 4 && title && !title.includes(needle.slice(0, Math.min(needle.length, 12)))) {
        continue;
      }
      return { imageUrl: row.url };
    }
  } catch {
    /* ignore */
  }
  return null;
}

declare global {
  interface Window {
    google?: {
      maps: {
        places: {
          PlacesServiceStatus: { OK: string };
          PlacesService: new (el: HTMLElement) => {
            findPlaceFromQuery: (
              req: {
                query: string;
                fields: string[];
                locationBias?: { lat: number; lng: number };
              },
              cb: (
                results: Array<{
                  place_id?: string;
                  formatted_address?: string;
                  photos?: Array<{ getUrl: (opts: { maxWidth: number }) => string }>;
                }> | null,
                status: string
              ) => void
            ) => void;
          };
        };
      };
    };
  }
}

function loadGoogleMapsPlaces(apiKey: string): Promise<typeof window.google | undefined> {
  const w = window;
  if (w.google?.maps?.places) return Promise.resolve(w.google);
  return new Promise((resolve) => {
    const existing = document.querySelector<HTMLScriptElement>('script[data-th-google-places]');
    if (existing) {
      existing.addEventListener('load', () => resolve(w.google));
      existing.addEventListener('error', () => resolve(undefined));
      return;
    }
    const script = document.createElement('script');
    script.dataset.thGooglePlaces = '1';
    script.async = true;
    script.src = `https://maps.googleapis.com/maps/api/js?key=${encodeURIComponent(apiKey)}&libraries=places`;
    script.onload = () => resolve(w.google);
    script.onerror = () => resolve(undefined);
    document.head.appendChild(script);
  });
}

async function googleJsPlacePhoto(options: {
  name: string;
  address?: string;
  city?: string;
  latitude?: number;
  longitude?: number;
  apiKey: string;
}): Promise<ResolvedPlacePhoto | null> {
  const g = await loadGoogleMapsPlaces(options.apiKey);
  if (!g?.maps?.places) return null;
  const query = [options.name, options.address, options.city].filter(Boolean).join(', ');
  const host = document.createElement('div');
  const svc = new g.maps.places.PlacesService(host);
  return new Promise((resolve) => {
    const req: {
      query: string;
      fields: string[];
      locationBias?: { lat: number; lng: number };
    } = {
      query,
      fields: ['place_id', 'photos', 'geometry', 'formatted_address', 'name']
    };
    if (Number.isFinite(options.latitude) && Number.isFinite(options.longitude)) {
      req.locationBias = { lat: Number(options.latitude), lng: Number(options.longitude) };
    }
    svc.findPlaceFromQuery(req, (results, status) => {
      if (status !== g.maps.places.PlacesServiceStatus.OK || !results?.length) {
        resolve(null);
        return;
      }
      const hit = results[0];
      const placeId = hit.place_id;
      const photo = hit.photos?.[0];
      const imageUrl = photo ? photo.getUrl({ maxWidth: 800 }) : '';
      resolve({
        imageUrl,
        sourceUrl: mapsListingUrl(
          options.name,
          hit.formatted_address || options.address,
          undefined,
          undefined,
          placeId
        ),
        provider: imageUrl ? 'google' : undefined
      });
    });
  });
}

/**
 * Venue photos for restaurants/cafés/shops/etc.
 * Prefer Google Place Photos (Maps JS + API key); otherwise Commons/Openverse near the pin.
 * Photo click always opens the Google Maps place listing (never directions).
 */
export async function resolveVenueListingPhoto(options: {
  name: string;
  address?: string;
  city?: string;
  latitude?: number;
  longitude?: number;
  googleMapsApiKey?: string;
}): Promise<ResolvedPlacePhoto | null> {
  const name = (options.name || '').trim();
  if (!name) return null;
  const city = (options.city || '').trim();
  const key = (options.googleMapsApiKey || '').trim();
  const ck = `${name.toLowerCase()}|${city.toLowerCase()}|${options.latitude ?? ''}|${options.longitude ?? ''}|k:${key ? '1' : '0'}`;
  const cache = loadCache();
  if (cache[ck]?.imageUrl || cache[ck]?.sourceUrl) return cache[ck];

  const listing = mapsListingUrl(name, options.address, options.latitude, options.longitude);

  if (key) {
    const g = await googleJsPlacePhoto({ ...options, apiKey: key });
    if (g?.imageUrl) {
      cache[ck] = g;
      saveCache(cache);
      return g;
    }
    if (g?.sourceUrl) {
      cache[ck] = { ...g, provider: g.provider || undefined };
      saveCache(cache);
    }
  }

  if (Number.isFinite(options.latitude) && Number.isFinite(options.longitude)) {
    const near = await commonsNearCoords(Number(options.latitude), Number(options.longitude));
    if (near?.imageUrl) {
      const resolved: ResolvedPlacePhoto = {
        imageUrl: near.imageUrl,
        sourceUrl: listing,
        provider: 'commons'
      };
      cache[ck] = resolved;
      saveCache(cache);
      return resolved;
    }
  }

  const ov = await openversePhoto(name, city);
  if (ov?.imageUrl) {
    const resolved: ResolvedPlacePhoto = {
      imageUrl: ov.imageUrl,
      sourceUrl: listing,
      provider: 'openverse'
    };
    cache[ck] = resolved;
    saveCache(cache);
    return resolved;
  }

  const sourceOnly: ResolvedPlacePhoto = {
    imageUrl: '',
    sourceUrl: listing,
    provider: undefined
  };
  cache[ck] = sourceOnly;
  saveCache(cache);
  return sourceOnly;
}

export { reverseGeocodeAddress, formatStartLabelWithAddress } from './googlePlacePhoto';
