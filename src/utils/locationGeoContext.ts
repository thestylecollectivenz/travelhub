import type { Place } from '../models/Place';

export interface GeoCoords {
  latitude: number;
  longitude: number;
  source: 'device' | 'place';
}

function isValidLatLng(lat: number, lon: number): boolean {
  return Number.isFinite(lat) && Number.isFinite(lon) && Math.abs(lat) <= 90 && Math.abs(lon) <= 180;
}

/** Prefer device GPS when available; fall back to the trip place coordinates. */
export async function resolveGeoCoords(place: Place | undefined): Promise<GeoCoords | undefined> {
  const placeLat = place?.latitude;
  const placeLon = place?.longitude;
  const hasPlace =
    placeLat !== undefined && placeLat !== null &&
    placeLon !== undefined && placeLon !== null &&
    isValidLatLng(Number(placeLat), Number(placeLon));

  if (typeof navigator !== 'undefined' && navigator.geolocation) {
    try {
      const pos = await new Promise<GeolocationPosition>((resolve, reject) => {
        navigator.geolocation.getCurrentPosition(resolve, reject, {
          enableHighAccuracy: false,
          timeout: 4000,
          maximumAge: 120000
        });
      });
      const lat = pos.coords.latitude;
      const lon = pos.coords.longitude;
      if (isValidLatLng(lat, lon)) {
        return { latitude: lat, longitude: lon, source: 'device' };
      }
    } catch {
      /* use place fallback */
    }
  }

  if (hasPlace) {
    return { latitude: Number(placeLat), longitude: Number(placeLon), source: 'place' };
  }
  return undefined;
}
