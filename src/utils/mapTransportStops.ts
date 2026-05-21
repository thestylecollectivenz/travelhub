import type { ItineraryEntry } from '../models/ItineraryEntry';
import type { TripDay } from '../models/TripDay';
import type { Place } from '../models/Place';
import { isPreTripDayRow } from './itineraryDayEntries';
import { parseAdditionalPlaceRefs } from './tripDayPlaces';

export const MAP_TRANSPORT_CATEGORIES = new Set(['Flights', 'Cruise', 'Transport']);

export type MapTransportStop = {
  id: string;
  placeId: string;
  title: string;
  latitude: number;
  longitude: number;
  dayNumber: number;
  label: string;
};

function isValidLatLng(lat: number, lon: number): boolean {
  return Number.isFinite(lat) && Number.isFinite(lon) && Math.abs(lat) <= 90 && Math.abs(lon) <= 180;
}

/** Map markers and route lines only for transport-related overnight / movement stops. */
export function buildMapTransportStops(options: {
  tripId: string;
  tripDays: TripDay[];
  entries: ItineraryEntry[];
  placeById: (id: string) => Place | undefined;
}): MapTransportStop[] {
  const { tripId, tripDays, entries, placeById } = options;
  const tripEntries = entries.filter((e) => e.tripId === tripId);
  const orderedDays = tripDays
    .filter((d) => d.tripId === tripId && !isPreTripDayRow(d))
    .sort((a, b) => a.dayNumber - b.dayNumber);

  const out: MapTransportStop[] = [];
  const seenPlaceDay = new Set<string>();

  for (const day of orderedDays) {
    const dayEntries = tripEntries.filter((e) => e.dayId === day.id);
    const hasTransport = dayEntries.some((e) => MAP_TRANSPORT_CATEGORIES.has(e.category));
    const transportDay =
      hasTransport || day.dayType === 'Sea' || day.dayType === 'TravelTransit' || day.dayType === 'PlacePort';
    if (!transportDay) continue;

    const addPlace = (placeId: string | undefined, suffix: string): void => {
      if (!placeId) return;
      const place = placeById(placeId);
      if (!place) return;
      const lat = Number(place.latitude);
      const lon = Number(place.longitude);
      if (!isValidLatLng(lat, lon)) return;
      const key = `${placeId}|${day.id}`;
      if (seenPlaceDay.has(key)) return;
      seenPlaceDay.add(key);
      const shortTitle = (place.title || 'Stop').split(',')[0].trim();
      out.push({
        id: `stop-${day.id}-${placeId}${suffix}`,
        placeId,
        title: place.title,
        latitude: lat,
        longitude: lon,
        dayNumber: day.dayNumber,
        label: `Day ${day.dayNumber}: ${shortTitle}`
      });
    };

    addPlace(day.primaryPlaceId, '');

    if (hasTransport) {
      const additional = parseAdditionalPlaceRefs(day.additionalPlaceIds);
      for (const ref of additional) {
        addPlace(ref.placeId, '-add');
      }
    }
  }

  return out;
}
