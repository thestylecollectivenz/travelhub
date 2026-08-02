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

/**
 * Build ordered map stops for the trip polyline.
 * Side trips (additional places) are inserted in list order for that day:
 * - returnToPrimary: primary → side(s) → primary again
 * - one-way: primary → side A → side B … (chain; no bounce back)
 */
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
  const daySideTrips = new Map<
    number,
    Array<{
      placeId: string;
      title: string;
      latitude: number;
      longitude: number;
      returnToPrimary: boolean;
      order: number;
    }>
  >();
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

    const refs = parseAdditionalPlaceRefs(day.additionalPlaceIds);
    refs.forEach((ref, order) => {
      const sidePlace = placeById(ref.placeId);
      if (!sidePlace) return;
      const sideLat = Number(sidePlace.latitude);
      const sideLon = Number(sidePlace.longitude);
      if (!isValidLatLng(sideLat, sideLon)) return;
      const dedupeKey = `${day.dayNumber}:${ref.placeId}:${order}`;
      if (seenSideTripKeys.has(dedupeKey)) return;
      seenSideTripKeys.add(dedupeKey);
      const list = daySideTrips.get(day.dayNumber) ?? [];
      list.push({
        placeId: ref.placeId,
        title: sidePlace.title,
        latitude: sideLat,
        longitude: sideLon,
        returnToPrimary: ref.returnToPrimary !== false,
        order
      });
      daySideTrips.set(day.dayNumber, list);
    });
  }

  const stops: MapTransportStop[] = [];

  for (const run of runs) {
    const shortTitle = placeShortTitle(run.title);
    const primaryStop: MapTransportStop = {
      id: `stop-${run.dayStart}-${run.dayEnd}-${run.placeId}`,
      placeId: run.placeId,
      title: run.title,
      latitude: run.latitude,
      longitude: run.longitude,
      dayNumber: run.dayStart,
      dayNumberEnd: run.dayEnd > run.dayStart ? run.dayEnd : undefined,
      label: formatDayRangeLabel(run.dayStart, run.dayEnd, shortTitle)
    };
    stops.push(primaryStop);

    for (let dayNum = run.dayStart; dayNum <= run.dayEnd; dayNum += 1) {
      const sides = daySideTrips.get(dayNum);
      if (!sides?.length) continue;
      const ordered = [...sides].sort((a, b) => a.order - b.order);
      let atPrimary = true;
      for (const side of ordered) {
        const sideShort = placeShortTitle(side.title);
        stops.push({
          id: `side-${dayNum}-${side.placeId}-${side.order}`,
          placeId: side.placeId,
          title: side.title,
          latitude: side.latitude,
          longitude: side.longitude,
          dayNumber: dayNum,
          label: `Day ${dayNum}: ${sideShort}${side.returnToPrimary ? ' (side trip)' : ''}`
        });
        atPrimary = false;
        if (side.returnToPrimary) {
          stops.push({
            id: `return-${dayNum}-${side.placeId}-${run.placeId}`,
            placeId: run.placeId,
            title: run.title,
            latitude: run.latitude,
            longitude: run.longitude,
            dayNumber: dayNum,
            label: `Day ${dayNum}: ${shortTitle} (return)`
          });
          atPrimary = true;
        }
      }
      // Always close the day at overnight primary before the next day's stop.
      if (!atPrimary) {
        stops.push({
          id: `return-dayend-${dayNum}-${run.placeId}`,
          placeId: run.placeId,
          title: run.title,
          latitude: run.latitude,
          longitude: run.longitude,
          dayNumber: dayNum,
          label: `Day ${dayNum}: ${shortTitle} (return)`
        });
      }
    }
  }

  return stops;
}
