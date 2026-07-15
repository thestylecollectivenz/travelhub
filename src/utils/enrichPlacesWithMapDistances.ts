import { haversineKm } from './distanceUtils';
import { placeQueryMapsUrl } from './googleMapsLink';
import { nominatimFetch } from './nominatimThrottle';

export type MappablePlace = {
  name: string;
  address?: string;
  mapsUrl?: string;
  websiteUrl?: string;
  /** Lat/lng if known from the model or prior geocode. */
  latitude?: number;
  longitude?: number;
  /** Distance field (dining description / nearest note). */
  distanceText?: string;
};

function isValid(lat: number, lng: number): boolean {
  return Number.isFinite(lat) && Number.isFinite(lng) && Math.abs(lat) <= 90 && Math.abs(lng) <= 180;
}

/** Format map-derived distance for cards (replaces invented AI distance strings). */
export function formatMapDistanceKm(km: number): string {
  if (!Number.isFinite(km) || km < 0) return '';
  if (km < 1) {
    const m = Math.max(1, Math.round(km * 1000));
    return `${m} m`;
  }
  if (km < 10) return `${km.toFixed(1)} km`;
  return `${Math.round(km)} km`;
}

/**
 * Walking / short-drive estimate from map distance.
 * Uses road-factor × haversine so "450 m walk" is never claimed for a 10+ km pin.
 */
export function formatTravelHintFromKm(km: number): string {
  if (!Number.isFinite(km) || km <= 0) return '';
  const roadKm = km * 1.3;
  const walkMins = Math.max(1, Math.round((roadKm * 1000) / 80));
  if (walkMins <= 25) return `${walkMins} min walk`;
  const driveMins = Math.max(1, Math.round((roadKm / 25) * 60));
  return `${driveMins} min drive`;
}

export function distanceTextFromCoords(
  originLat: number,
  originLng: number,
  placeLat: number,
  placeLng: number
): string {
  const km = haversineKm(originLat, originLng, placeLat, placeLng);
  const dist = formatMapDistanceKm(km);
  const hint = formatTravelHintFromKm(km);
  if (dist && hint) return `${dist} · ${hint}`;
  return dist || hint;
}

async function geocodeQuery(query: string): Promise<{ lat: number; lng: number } | undefined> {
  const q = query.trim();
  if (!q) return undefined;
  try {
    const url = `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(q)}&format=json&limit=1`;
    const resp = await nominatimFetch(url, { headers: { Accept: 'application/json' } });
    if (!resp.ok) return undefined;
    const data = (await resp.json()) as Array<{ lat?: string; lon?: string }>;
    const lat = Number(data[0]?.lat);
    const lng = Number(data[0]?.lon);
    if (isValid(lat, lng)) return { lat, lng };
  } catch {
    /* ignore */
  }
  return undefined;
}

export async function geocodePlaceNearAnchor(
  name: string,
  address: string | undefined,
  locality: string | undefined,
  anchorLat: number,
  anchorLng: number
): Promise<{ lat: number; lng: number } | undefined> {
  const attempts = [
    [name, address, locality].filter(Boolean).join(', '),
    [name, locality].filter(Boolean).join(', '),
    [name, address].filter(Boolean).join(', '),
    name
  ].filter((q, i, arr) => q.trim() && arr.indexOf(q) === i);

  let best: { lat: number; lng: number; km: number } | undefined;
  for (const q of attempts) {
    const hit = await geocodeQuery(q);
    if (!hit) continue;
    const km = haversineKm(anchorLat, anchorLng, hit.lat, hit.lng);
    // Reject wildly wrong geocodes (wrong city) — more than ~80 km from the search anchor.
    if (km > 80) continue;
    if (!best || km < best.km) best = { ...hit, km };
    // Prefer the first strong local hit within 5 km
    if (km <= 5) return hit;
  }
  return best ? { lat: best.lat, lng: best.lng } : undefined;
}

/**
 * Replace AI-invented distances with geocoded map distances from the search anchor.
 * Also fills a Google Maps place URL when missing.
 */
export async function enrichPlacesWithMapDistances<T extends MappablePlace>(
  places: T[],
  origin: { latitude: number; longitude: number; locality?: string }
): Promise<T[]> {
  const out: T[] = [];
  for (const p of places) {
    let lat = p.latitude;
    let lng = p.longitude;
    if (!isValid(Number(lat), Number(lng))) {
      const hit = await geocodePlaceNearAnchor(
        p.name,
        p.address,
        origin.locality,
        origin.latitude,
        origin.longitude
      );
      if (hit) {
        lat = hit.lat;
        lng = hit.lng;
      }
    }
    let distanceText = p.distanceText;
    if (isValid(Number(lat), Number(lng))) {
      distanceText = distanceTextFromCoords(origin.latitude, origin.longitude, Number(lat), Number(lng));
    } else {
      // No trustworthy pin — drop invented AI distance rather than show a wrong walk time.
      distanceText = undefined;
    }
    const mapsUrl =
      (p.mapsUrl || '').trim() ||
      placeQueryMapsUrl(p.name, p.address) ||
      (isValid(Number(lat), Number(lng))
        ? `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(`${lat},${lng}`)}`
        : undefined);
    out.push({
      ...p,
      latitude: lat,
      longitude: lng,
      distanceText,
      mapsUrl
    });
  }
  // Nearest first when we have distances
  out.sort((a, b) => {
    const ka = a.latitude != null && a.longitude != null
      ? haversineKm(origin.latitude, origin.longitude, Number(a.latitude), Number(a.longitude))
      : Number.POSITIVE_INFINITY;
    const kb = b.latitude != null && b.longitude != null
      ? haversineKm(origin.latitude, origin.longitude, Number(b.latitude), Number(b.longitude))
      : Number.POSITIVE_INFINITY;
    return ka - kb;
  });
  return out;
}
