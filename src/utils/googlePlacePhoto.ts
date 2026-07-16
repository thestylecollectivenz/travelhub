import { nominatimFetch } from './nominatimThrottle';
import type { ResolvedPlacePhoto } from './placePhotoResolve';

type CacheRow = Record<string, ResolvedPlacePhoto>;
const CACHE_KEY = 'travelhub-google-place-photos-v1';

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

function cacheKey(name: string, city: string, lat?: number, lng?: number): string {
  const geo =
    Number.isFinite(lat) && Number.isFinite(lng) ? `${Number(lat).toFixed(4)},${Number(lng).toFixed(4)}` : '';
  return `${name.trim().toLowerCase()}|${city.trim().toLowerCase()}|${geo}`;
}

/**
 * Resolve a real venue photo from Google Place Photos when a Maps API key is configured.
 * Source URL always points at the Google Maps place listing for verification.
 */
export async function resolveGooglePlaceListingPhoto(options: {
  name: string;
  address?: string;
  city?: string;
  latitude?: number;
  longitude?: number;
  googleMapsApiKey?: string;
}): Promise<ResolvedPlacePhoto | null> {
  const key = (options.googleMapsApiKey || '').trim();
  const name = (options.name || '').trim();
  if (!key || !name) return null;

  const city = (options.city || '').trim();
  const ck = cacheKey(name, city, options.latitude, options.longitude);
  const cache = loadCache();
  if (cache[ck]) return cache[ck];

  const query = [name, options.address, city].filter(Boolean).join(', ');
  const params = new URLSearchParams({
    input: query,
    inputtype: 'textquery',
    fields: 'photos,place_id,geometry,formatted_address,name',
    key
  });
  if (Number.isFinite(options.latitude) && Number.isFinite(options.longitude)) {
    params.set('locationbias', `point:${options.latitude},${options.longitude}`);
  }

  try {
    const resp = await fetch(
      `https://maps.googleapis.com/maps/api/place/findplacefromtext/json?${params.toString()}`
    );
    if (!resp.ok) return null;
    const data = (await resp.json()) as {
      candidates?: Array<{
        place_id?: string;
        photos?: Array<{ photo_reference?: string }>;
        formatted_address?: string;
      }>;
    };
    const hit = data.candidates?.[0];
    const placeId = (hit?.place_id || '').trim();
    const photoRef = (hit?.photos?.[0]?.photo_reference || '').trim();
    if (!placeId) return null;

    const sourceUrl = `https://www.google.com/maps/search/?api=1&query_place_id=${encodeURIComponent(placeId)}`;
    if (!photoRef) {
      const resolved: ResolvedPlacePhoto = { imageUrl: '', sourceUrl };
      cache[ck] = resolved;
      saveCache(cache);
      return resolved;
    }

    const imageUrl =
      `https://maps.googleapis.com/maps/api/place/photo?maxwidth=800` +
      `&photo_reference=${encodeURIComponent(photoRef)}&key=${encodeURIComponent(key)}`;
    const resolved: ResolvedPlacePhoto = { imageUrl, sourceUrl };
    cache[ck] = resolved;
    saveCache(cache);
    return resolved;
  } catch {
    return null;
  }
}

/** Reverse geocode a short street address for labels (name + address in brackets). */
export async function reverseGeocodeAddress(lat: number, lng: number): Promise<string | undefined> {
  try {
    const url = `https://nominatim.openstreetmap.org/reverse?lat=${lat}&lon=${lng}&format=json&addressdetails=1`;
    const resp = await nominatimFetch(url, { headers: { Accept: 'application/json' } });
    if (!resp.ok) return undefined;
    const data = (await resp.json()) as {
      address?: {
        house_number?: string;
        road?: string;
        suburb?: string;
        city?: string;
        town?: string;
        village?: string;
      };
    };
    const a = data.address;
    if (!a) return undefined;
    const street = [a.house_number, a.road].filter(Boolean).join(' ').trim();
    const locality = a.suburb || a.city || a.town || a.village;
    if (street && locality) return `${street}, ${locality}`;
    return street || locality || undefined;
  } catch {
    return undefined;
  }
}

export function formatStartLabelWithAddress(name: string, address?: string): string {
  const n = (name || '').trim();
  const a = (address || '').trim();
  if (!n) return a || 'Selected point';
  if (!a) return n;
  if (n.toLowerCase().includes(a.toLowerCase()) || /\(.*\)/.test(n)) return n;
  return `${n} (${a})`;
}
