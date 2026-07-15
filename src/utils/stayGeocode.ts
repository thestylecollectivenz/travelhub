import { nominatimFetch } from './nominatimThrottle';

const GEO_CACHE_PREFIX = 'travelhub-stay-geo:';

export type StayGeoResult = { lat: number; lng: number; label: string };

function isValid(lat: number, lng: number): boolean {
  return Number.isFinite(lat) && Number.isFinite(lng) && Math.abs(lat) <= 90 && Math.abs(lng) <= 180;
}

function cacheGet(key: string): StayGeoResult | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = window.sessionStorage.getItem(`${GEO_CACHE_PREFIX}${key}`);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as StayGeoResult;
    if (!isValid(parsed.lat, parsed.lng)) return null;
    return parsed;
  } catch {
    return null;
  }
}

function cacheSet(key: string, value: StayGeoResult): void {
  if (typeof window === 'undefined') return;
  try {
    window.sessionStorage.setItem(`${GEO_CACHE_PREFIX}${key}`, JSON.stringify(value));
  } catch {
    /* ignore */
  }
}

/**
 * Best-effort geocode for an overnight stay so "near accommodation" matches the hotel,
 * not only the city Place pin.
 */
export async function geocodeStayQuery(
  query: string,
  label: string
): Promise<StayGeoResult | undefined> {
  const q = query.trim();
  if (!q) return undefined;
  const cached = cacheGet(q.toLowerCase());
  if (cached) return { ...cached, label: label || cached.label };

  try {
    const url = `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(q)}&format=json&limit=1`;
    const resp = await nominatimFetch(url, { headers: { Accept: 'application/json' } });
    if (!resp.ok) return undefined;
    const data = (await resp.json()) as Array<{ lat?: string; lon?: string; display_name?: string }>;
    const hit = data[0];
    const lat = Number(hit?.lat);
    const lng = Number(hit?.lon);
    if (!isValid(lat, lng)) return undefined;
    const result: StayGeoResult = {
      lat,
      lng,
      label: label.trim() || (hit?.display_name || '').split(',').slice(0, 2).join(',').trim() || 'Stay'
    };
    cacheSet(q.toLowerCase(), result);
    return result;
  } catch {
    return undefined;
  }
}

export type StayGeocodeFields = {
  title?: string;
  streetAddress?: string;
  location?: string;
};

/**
 * Prefer the hotel record address; never mix in the city Place title (that pulls Nominatim
 * to the city centroid while the UI still shows the hotel name).
 */
export async function geocodeStayFromHotelRecord(
  stay: StayGeocodeFields
): Promise<StayGeoResult | undefined> {
  const label = (stay.title || '').trim() || 'Accommodation';
  const street = (stay.streetAddress || '').trim();
  const loc = (stay.location || '').trim();

  const attempts: string[] = [];
  if (street) attempts.push(street);
  if (street && loc && loc.toLowerCase() !== street.toLowerCase()) {
    attempts.push(`${street}, ${loc}`);
  }
  if (loc && loc.toLowerCase() !== street.toLowerCase()) attempts.push(loc);
  if (label && loc) attempts.push(`${label}, ${loc}`);

  for (const query of attempts) {
    const hit = await geocodeStayQuery(query, label);
    if (hit) return hit;
  }
  return undefined;
}
