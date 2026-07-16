import { haversineKm } from './distanceUtils';
import { placeQueryMapsUrl } from './googleMapsLink';
import { nominatimFetch } from './nominatimThrottle';
import { resolveTravelModeDurations, type TravelModeDurations } from './travelModeDurations';

export type MappablePlace = {
  name: string;
  address?: string;
  mapsUrl?: string;
  websiteUrl?: string;
  latitude?: number;
  longitude?: number;
  distanceText?: string;
  walkMinutes?: number;
  driveMinutes?: number;
  transitMinutes?: number;
};

function isValid(lat: number, lng: number): boolean {
  return Number.isFinite(lat) && Number.isFinite(lng) && Math.abs(lat) <= 90 && Math.abs(lng) <= 180;
}

export function formatMapDistanceKm(km: number): string {
  if (!Number.isFinite(km) || km < 0) return '';
  if (km < 1) {
    const m = Math.max(1, Math.round(km * 1000));
    return `${m} m`;
  }
  if (km < 10) return `${km.toFixed(1)} km`;
  return `${Math.round(km)} km`;
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
    [address, locality].filter(Boolean).join(', '),
    [name, locality].filter(Boolean).join(', '),
    [name, address].filter(Boolean).join(', '),
    name
  ].filter((q, i, arr) => q.trim() && arr.indexOf(q) === i);

  let best: { lat: number; lng: number; km: number } | undefined;
  for (const q of attempts) {
    const hit = await geocodeQuery(q);
    if (!hit) continue;
    const km = haversineKm(anchorLat, anchorLng, hit.lat, hit.lng);
    if (km > 80) continue;
    if (!best || km < best.km) best = { ...hit, km };
    if (km <= 5) return hit;
  }
  return best ? { lat: best.lat, lng: best.lng } : undefined;
}

function distanceLabel(km: number, modes: TravelModeDurations): string {
  const dist = formatMapDistanceKm(km);
  const parts = [dist];
  if (modes.walkMinutes) parts.push(`${modes.walkMinutes} min walk`);
  if (modes.driveMinutes) parts.push(`${modes.driveMinutes} min drive`);
  return parts.filter(Boolean).join(' · ');
}

/** Prefer Google Maps place URL by address (or coords), never a fake invented search. */
export function mapsUrlForPlace(name: string, address?: string, lat?: number, lng?: number): string | undefined {
  const addr = (address || '').trim();
  if (addr) return placeQueryMapsUrl(addr) || placeQueryMapsUrl(name, addr);
  if (isValid(Number(lat), Number(lng))) {
    return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(`${lat},${lng}`)}`;
  }
  return placeQueryMapsUrl(name);
}

/**
 * Replace invented AI distances with geocoded + OSRM walk/drive times.
 */
export async function enrichPlacesWithMapDistances<T extends MappablePlace>(
  places: T[],
  origin: { latitude: number; longitude: number; locality?: string }
): Promise<
  Array<
    T & {
      latitude?: number;
      longitude?: number;
      distanceText?: string;
      walkMinutes?: number;
      driveMinutes?: number;
      transitMinutes?: number;
      mapsUrl?: string;
    }
  >
> {
  const out: Array<
    T & {
      latitude?: number;
      longitude?: number;
      distanceText?: string;
      walkMinutes?: number;
      driveMinutes?: number;
      transitMinutes?: number;
      mapsUrl?: string;
    }
  > = [];
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

    let distanceText: string | undefined;
    let walkMinutes: number | undefined;
    let driveMinutes: number | undefined;
    let transitMinutes: number | undefined;

    if (isValid(Number(lat), Number(lng))) {
      const km = haversineKm(origin.latitude, origin.longitude, Number(lat), Number(lng));
      const modes = await resolveTravelModeDurations(
        origin.latitude,
        origin.longitude,
        Number(lat),
        Number(lng)
      );
      walkMinutes = modes.walkMinutes;
      driveMinutes = modes.driveMinutes;
      transitMinutes = modes.transitMinutes;
      distanceText = distanceLabel(km, modes);
    }

    out.push({
      ...p,
      latitude: lat,
      longitude: lng,
      distanceText,
      walkMinutes,
      driveMinutes,
      transitMinutes,
      mapsUrl: mapsUrlForPlace(p.name, p.address, lat, lng) || p.mapsUrl
    });
  }

  out.sort((a, b) => {
    const ka =
      a.latitude != null && a.longitude != null
        ? haversineKm(origin.latitude, origin.longitude, Number(a.latitude), Number(a.longitude))
        : Number.POSITIVE_INFINITY;
    const kb =
      b.latitude != null && b.longitude != null
        ? haversineKm(origin.latitude, origin.longitude, Number(b.latitude), Number(b.longitude))
        : Number.POSITIVE_INFINITY;
    return ka - kb;
  });
  return out;
}
