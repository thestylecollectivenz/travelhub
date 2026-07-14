import type { Place } from '../models/Place';
import { haversineKm } from './distanceUtils';
import { placeNameAndCountry } from './locationInfoEntry';

export interface GeoCoords {
  latitude: number;
  longitude: number;
  source: 'device' | 'place';
}

/** Within this distance of the trip place, treat device GPS as on-site for nearest/dining (desktop default). */
const ON_SITE_KM = 25;

/** Mobile Near You from a trip place uses a wider on-site radius. */
export const MOBILE_NEAR_YOU_ON_SITE_KM = 50;

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
 * - overrideCoords + forceTripPlace: use custom map-picked centre while keeping placeName as the city.
 */
export async function resolveLocationSearchContext(
  place: Place | undefined,
  options?: {
    onSiteKm?: number;
    forceTripPlace?: boolean;
    overrideCoords?: { lat: number; lng: number };
  }
): Promise<LocationSearchContext | undefined> {
  const onSiteKm = options?.onSiteKm ?? ON_SITE_KM;
  const forceTripPlace = options?.forceTripPlace === true;
  const override = options?.overrideCoords;
  const { placeName, country } = place
    ? placeNameAndCountry(place)
    : { placeName: 'Selected point', country: '' };
  const placeLat = place != null ? Number(place.latitude) : NaN;
  const placeLon = place != null ? Number(place.longitude) : NaN;
  const hasPlace = isValidLatLng(placeLat, placeLon);

  if (
    override &&
    isValidLatLng(override.lat, override.lng) &&
    (forceTripPlace || !place)
  ) {
    return {
      mode: 'trip_place',
      latitude: override.lat,
      longitude: override.lng,
      placeName,
      country
    };
  }

  if (!place) return undefined;

  if (!forceTripPlace) {
    const device = await readDeviceCoords();
    if (device && hasPlace) {
      const distKm = haversineKm(device.latitude, device.longitude, placeLat, placeLon);
      if (distKm <= onSiteKm) {
        return {
          mode: 'onsite',
          latitude: device.latitude,
          longitude: device.longitude,
          placeName,
          country
        };
      }
    }
  }

  if (override && isValidLatLng(override.lat, override.lng)) {
    return {
      mode: 'trip_place',
      latitude: override.lat,
      longitude: override.lng,
      placeName,
      country
    };
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

  if (!forceTripPlace) {
    const device = await readDeviceCoords();
    if (device) {
      return {
        mode: 'onsite',
        latitude: device.latitude,
        longitude: device.longitude,
        placeName: 'Current location',
        country: country || ''
      };
    }
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
