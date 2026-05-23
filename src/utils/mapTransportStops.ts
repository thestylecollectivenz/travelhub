import type { ItineraryEntry } from '../models/ItineraryEntry';
import type { TripDay } from '../models/TripDay';
import type { Place } from '../models/Place';
import { isPreTripDayRow } from './itineraryDayEntries';

export const MAP_TRANSPORT_CATEGORIES = new Set(['Flights', 'Cruise', 'Transport']);

export type MapTransportStop = {
  id: string;
  placeId: string;
  title: string;
  latitude: number;
  longitude: number;
  dayNumber: number;
  dayNumberEnd?: number;
  label: string;
};

function formatDayRangeLabel(dayStart: number, dayEnd: number, placeShort: string): string {
  if (dayEnd > dayStart) {
    return `Days ${dayStart} to ${dayEnd}: ${placeShort}`;
  }
  return `Day ${dayStart}: ${placeShort}`;
}

function placeShortTitle(title: string): string {
  return (title || 'Stop').split(',')[0].trim();
}

/** Merge consecutive days at the same location (by city/short name), not only identical placeId. */
export function mergeConsecutiveMapStops(stops: MapTransportStop[]): MapTransportStop[] {
  if (stops.length <= 1) return stops;
  const out: MapTransportStop[] = [];
  let run = { ...stops[0], dayNumberEnd: stops[0].dayNumber };

  const runKey = placeShortTitle(run.title).toLowerCase();

  for (let i = 1; i < stops.length; i++) {
    const cur = stops[i];
    const curKey = placeShortTitle(cur.title).toLowerCase();
    const sameLocation = curKey === runKey;
    const consecutive = cur.dayNumber === (run.dayNumberEnd ?? run.dayNumber) + 1;
    if (sameLocation && consecutive) {
      run = { ...run, dayNumberEnd: cur.dayNumber };
      const shortTitle = placeShortTitle(run.title);
      run.label = formatDayRangeLabel(run.dayNumber, cur.dayNumber, shortTitle);
    } else {
      out.push(run);
      run = { ...cur, dayNumberEnd: cur.dayNumber };
    }
  }
  out.push(run);
  return out;
}

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

  for (const day of orderedDays) {
    const dayEntries = tripEntries.filter((e) => e.dayId === day.id);
    const hasTransport = dayEntries.some((e) => MAP_TRANSPORT_CATEGORIES.has(e.category));
    const transportDay =
      hasTransport || day.dayType === 'Sea' || day.dayType === 'TravelTransit' || day.dayType === 'PlacePort';
    if (!transportDay || !day.primaryPlaceId) continue;

    const place = placeById(day.primaryPlaceId);
    if (!place) continue;
    const lat = Number(place.latitude);
    const lon = Number(place.longitude);
    if (!isValidLatLng(lat, lon)) continue;

    const shortTitle = placeShortTitle(place.title);
    out.push({
      id: `stop-${day.id}-${place.id}`,
      placeId: place.id,
      title: place.title,
      latitude: lat,
      longitude: lon,
      dayNumber: day.dayNumber,
      label: `Day ${day.dayNumber}: ${shortTitle}`
    });
  }

  return mergeConsecutiveMapStops(out);
}
