import type { Place } from '../models/Place';
import { haversineKm } from './distanceUtils';
import { placeNameAndCountry } from './locationInfoEntry';

export interface GeoCoords {
  latitude: number;
  longitude: number;
  source: 'device' | 'place';
}

/** Within this distance of the trip place, treat device GPS as on-site for nearest/dining. */
const ON_SITE_KM = 25;

export type LocationSearchMode = 'onsite' | 'trip_place';

export interface LocationSearchContext {
  mode: LocationSearchMode;
  latitude: number;
  longitude: number;
  placeName: string;
  country: string;
}

function isValidLatLng(lat: number, lon: number): boolean {
  return Number.isFinite(lat) && Number.isFinite(lon) && Math.abs(lat) <= 90 && Math.abs(lon) <= 180;
}

async function readDeviceCoords(): Promise<GeoCoords | undefined> {
  if (typeof navigator === 'undefined' || !navigator.geolocation) return undefined;
  try {
    const pos = await new Promise<GeolocationPosition>((resolve, reject) => {
      navigator.geolocation.getCurrentPosition(resolve, reject, {
        enableHighAccuracy: true,
        timeout: 6000,
        maximumAge: 60000
      });
    });
    const lat = pos.coords.latitude;
    const lon = pos.coords.longitude;
    if (isValidLatLng(lat, lon)) {
      return { latitude: lat, longitude: lon, source: 'device' };
    }
  } catch {
    /* no device fix */
  }
  return undefined;
}

/**
 * Nearest/dining search anchor:
 * - On-site (device within ~25 km of trip place): use GPS — finds what's actually near the traveller.
 * - Otherwise: use trip place coordinates — planning from home won't mix NZ GPS with Colmar results.
 */
export async function resolveLocationSearchContext(place: Place | undefined): Promise<LocationSearchContext | undefined> {
  if (!place) return undefined;
  const { placeName, country } = placeNameAndCountry(place);
  const placeLat = Number(place.latitude);
  const placeLon = Number(place.longitude);
  const hasPlace = isValidLatLng(placeLat, placeLon);

  const device = await readDeviceCoords();
  if (device && hasPlace) {
    const distKm = haversineKm(device.latitude, device.longitude, placeLat, placeLon);
    if (distKm <= ON_SITE_KM) {
      return {
        mode: 'onsite',
        latitude: device.latitude,
        longitude: device.longitude,
        placeName,
        country
      };
    }
  }

  if (hasPlace) {
    return {
      mode: 'trip_place',
      latitude: placeLat,
      longitude: placeLon,
      placeName,
      country
    };
  }

  if (device) {
    return {
      mode: 'onsite',
      latitude: device.latitude,
      longitude: device.longitude,
      placeName: 'Current location',
      country: country || ''
    };
  }

  return undefined;
}

/** @deprecated Use resolveLocationSearchContext */
export async function resolveGeoCoords(place: Place | undefined): Promise<GeoCoords | undefined> {
  const ctx = await resolveLocationSearchContext(place);
  if (!ctx) return undefined;
  return {
    latitude: ctx.latitude,
    longitude: ctx.longitude,
    source: ctx.mode === 'onsite' ? 'device' : 'place'
  };
}
