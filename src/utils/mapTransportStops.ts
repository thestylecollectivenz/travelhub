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

function locationKeyFromTitle(title: string): string {
  return placeShortTitle(title).toLowerCase();
}

function isValidLatLng(lat: number, lon: number): boolean {
  return Number.isFinite(lat) && Number.isFinite(lon) && Math.abs(lat) <= 90 && Math.abs(lon) <= 180;
}

/** Group consecutive trip days that share the same primary place (by city short name). */
export function buildMapTransportStops(options: {
  tripId: string;
  tripDays: TripDay[];
  entries: ItineraryEntry[];
  placeById: (id: string) => Place | undefined;
}): MapTransportStop[] {
  const { tripId, tripDays, placeById } = options;
  const orderedDays = tripDays
    .filter((d) => d.tripId === tripId && !isPreTripDayRow(d))
    .sort((a, b) => a.dayNumber - b.dayNumber);

  type Run = {
    placeId: string;
    title: string;
    latitude: number;
    longitude: number;
    dayStart: number;
    dayEnd: number;
    locationKey: string;
  };

  const runs: Run[] = [];
  const sideTripStops: MapTransportStop[] = [];
  const seenSideTripKeys = new Set<string>();

  for (const day of orderedDays) {
    if (!day.primaryPlaceId) continue;
    const place = placeById(day.primaryPlaceId);
    if (!place) continue;
    const lat = Number(place.latitude);
    const lon = Number(place.longitude);
    if (!isValidLatLng(lat, lon)) continue;

    const locationKey = locationKeyFromTitle(place.title);
    const last = runs[runs.length - 1];
    if (last && last.locationKey === locationKey && day.dayNumber === last.dayEnd + 1) {
      last.dayEnd = day.dayNumber;
      last.placeId = place.id;
      last.title = place.title;
      last.latitude = lat;
      last.longitude = lon;
    } else {
      runs.push({
        placeId: place.id,
        title: place.title,
        latitude: lat,
        longitude: lon,
        dayStart: day.dayNumber,
        dayEnd: day.dayNumber,
        locationKey
      });
    }

    for (const ref of parseAdditionalPlaceRefs(day.additionalPlaceIds)) {
      const sidePlace = placeById(ref.placeId);
      if (!sidePlace) continue;
      const sideLat = Number(sidePlace.latitude);
      const sideLon = Number(sidePlace.longitude);
      if (!isValidLatLng(sideLat, sideLon)) continue;
      const dedupeKey = `${day.dayNumber}:${ref.placeId}`;
      if (seenSideTripKeys.has(dedupeKey)) continue;
      seenSideTripKeys.add(dedupeKey);
      const shortTitle = placeShortTitle(sidePlace.title);
      sideTripStops.push({
        id: `side-${day.dayNumber}-${ref.placeId}`,
        placeId: ref.placeId,
        title: sidePlace.title,
        latitude: sideLat,
        longitude: sideLon,
        dayNumber: day.dayNumber,
        label: `Day ${day.dayNumber}: ${shortTitle}${ref.returnToPrimary ? ' (side trip)' : ''}`
      });
    }
  }

  const primaryStops = runs.map((run) => {
    const shortTitle = placeShortTitle(run.title);
    return {
      id: `stop-${run.dayStart}-${run.dayEnd}-${run.placeId}`,
      placeId: run.placeId,
      title: run.title,
      latitude: run.latitude,
      longitude: run.longitude,
      dayNumber: run.dayStart,
      dayNumberEnd: run.dayEnd > run.dayStart ? run.dayEnd : undefined,
      label: formatDayRangeLabel(run.dayStart, run.dayEnd, shortTitle)
    };
  });

  return [...primaryStops, ...sideTripStops].sort((a, b) => a.dayNumber - b.dayNumber || a.label.localeCompare(b.label));
}
