import type { ItineraryEntry } from '../models/ItineraryEntry';
import type { TripDay } from '../models/TripDay';
import type { Place } from '../models/Place';
import { haversineKm } from './distanceUtils';
import { isPreTripDayRow } from './itineraryDayEntries';
import { placeDisplayLabel } from './placeDisplayLabel';
import { buildPlacesVisitSummary, type PlaceVisitRow } from './placesVisitSummary';

export interface PlaceVisitAnalytics {
  uniquePlaces: number;
  multiDayPlaces: number;
  returnVisitPlaces: number;
  avgStayNights: number;
  longestStayNights: number;
  totalActivities: number;
  rows: PlaceVisitRow[];
}

export interface PlaceDetailStats {
  placeKey: string;
  label: string;
  placeId?: string;
  dayNumbers: number[];
  stayNights: number;
  visitBlocks: number;
  activityCount: number;
  latitude?: number;
  longitude?: number;
  distanceFromPrevKm?: number;
  distanceToNextKm?: number;
  prevPlaceLabel?: string;
  nextPlaceLabel?: string;
}

interface OvernightStop {
  placeKey: string;
  label: string;
  placeId?: string;
  dayNumber: number;
  lat?: number;
  lng?: number;
}

function placeKeyForDay(day: TripDay, placeById: (id: string) => Place | undefined): OvernightStop | undefined {
  if (isPreTripDayRow(day)) return undefined;
  if (day.primaryPlaceId) {
    const place = placeById(day.primaryPlaceId);
    const label = place ? placeDisplayLabel(place) : day.displayTitle || 'Place';
    return {
      placeKey: `id:${day.primaryPlaceId}`,
      label,
      placeId: day.primaryPlaceId,
      dayNumber: day.dayNumber,
      lat: place?.latitude,
      lng: place?.longitude
    };
  }
  const title = (day.displayTitle || '').trim();
  if (!title) return undefined;
  return {
    placeKey: `title:${title.toLowerCase()}`,
    label: title,
    dayNumber: day.dayNumber
  };
}

function contiguousStayBlocks(stops: OvernightStop[]): Array<{ placeKey: string; label: string; placeId?: string; dayNumbers: number[] }> {
  const blocks: Array<{ placeKey: string; label: string; placeId?: string; dayNumbers: number[] }> = [];
  for (const stop of stops) {
    const last = blocks[blocks.length - 1];
    if (last && last.placeKey === stop.placeKey) {
      last.dayNumbers.push(stop.dayNumber);
    } else {
      blocks.push({
        placeKey: stop.placeKey,
        label: stop.label,
        placeId: stop.placeId,
        dayNumbers: [stop.dayNumber]
      });
    }
  }
  return blocks;
}

export function buildPlacesVisitAnalytics(
  tripDays: TripDay[],
  entries: ItineraryEntry[],
  placeById: (id: string) => Place | undefined
): PlaceVisitAnalytics {
  const summary = buildPlacesVisitSummary(tripDays, entries, placeById);
  const sortedDays = [...tripDays].filter((d) => !isPreTripDayRow(d)).sort((a, b) => a.dayNumber - b.dayNumber);
  const stops: OvernightStop[] = [];
  for (const day of sortedDays) {
    const stop = placeKeyForDay(day, placeById);
    if (stop) stops.push(stop);
  }
  const blocks = contiguousStayBlocks(stops);
  const stayNightsPerBlock = blocks.map((b) => Math.max(0, b.dayNumbers.length - 1));
  const totalStayNights = stayNightsPerBlock.reduce((a, n) => a + n, 0);
  const avgStayNights = blocks.length ? totalStayNights / blocks.length : 0;
  const longestStayNights = stayNightsPerBlock.length ? Math.max(...stayNightsPerBlock) : 0;

  const visitsByKey = new Map<string, number>();
  for (const block of blocks) {
    visitsByKey.set(block.placeKey, (visitsByKey.get(block.placeKey) ?? 0) + 1);
  }

  const multiDayPlaces = summary.rows.filter((r) => r.dayNumbers.length > 1).length;
  const returnVisitPlaces = Array.from(visitsByKey.values()).filter((n) => n > 1).length;
  const totalActivities = summary.rows.reduce((a, r) => a + r.entryCount, 0);

  return {
    uniquePlaces: summary.uniquePlaces,
    multiDayPlaces,
    returnVisitPlaces,
    avgStayNights: Math.round(avgStayNights * 10) / 10,
    longestStayNights,
    totalActivities,
    rows: summary.rows
  };
}

export function buildPlaceDetailStats(
  placeKey: string,
  tripDays: TripDay[],
  entries: ItineraryEntry[],
  placeById: (id: string) => Place | undefined
): PlaceDetailStats | undefined {
  const sortedDays = [...tripDays].filter((d) => !isPreTripDayRow(d)).sort((a, b) => a.dayNumber - b.dayNumber);
  const stops: OvernightStop[] = [];
  for (const day of sortedDays) {
    const stop = placeKeyForDay(day, placeById);
    if (stop) stops.push(stop);
  }
  const blocks = contiguousStayBlocks(stops);
  const matchingBlocks = blocks.filter((b) => b.placeKey === placeKey);
  if (!matchingBlocks.length) {
    const summary = buildPlacesVisitSummary(tripDays, entries, placeById);
    const row = summary.rows.find((r) => r.label.trim().toLowerCase() === placeKey.replace(/^title:/, ''));
    if (!row) return undefined;
    return {
      placeKey,
      label: row.label,
      dayNumbers: row.dayNumbers,
      stayNights: Math.max(0, row.dayNumbers.length - 1),
      visitBlocks: 1,
      activityCount: row.entryCount
    };
  }

  const label = matchingBlocks[0].label;
  const placeId = matchingBlocks[0].placeId;
  const dayNumbers: number[] = [];
  for (const b of matchingBlocks) {
    for (const n of b.dayNumbers) {
      if (dayNumbers.indexOf(n) < 0) dayNumbers.push(n);
    }
  }
  dayNumbers.sort((a, b) => a - b);
  const stayNights = matchingBlocks.reduce((a, b) => a + Math.max(0, b.dayNumbers.length - 1), 0);

  let activityCount = 0;
  for (const entry of entries) {
    const day = tripDays.find((d) => d.id === entry.dayId);
    if (!day || dayNumbers.indexOf(day.dayNumber) < 0) continue;
    activityCount += 1;
    for (const sub of entry.subItems ?? []) {
      if ((sub.title || '').trim()) activityCount += 1;
    }
  }

  const blockIndex = blocks.findIndex((b) => b.placeKey === placeKey);
  const prevBlock = blockIndex > 0 ? blocks[blockIndex - 1] : undefined;
  const nextBlock = blockIndex >= 0 && blockIndex < blocks.length - 1 ? blocks[blockIndex + 1] : undefined;
  const stopFor = (block: (typeof blocks)[0], dayNumber: number): OvernightStop | undefined =>
    stops.find((s) => s.placeKey === block.placeKey && s.dayNumber === dayNumber);

  const currentStop = stopFor(matchingBlocks[0], matchingBlocks[0].dayNumbers[0]);
  const prevStop =
    prevBlock && prevBlock.dayNumbers.length
      ? stopFor(prevBlock, prevBlock.dayNumbers[prevBlock.dayNumbers.length - 1])
      : undefined;
  const nextStop =
    nextBlock && nextBlock.dayNumbers.length ? stopFor(nextBlock, nextBlock.dayNumbers[0]) : undefined;

  let distanceFromPrevKm: number | undefined;
  let distanceToNextKm: number | undefined;
  if (prevStop?.lat != null && prevStop.lng != null && currentStop?.lat != null && currentStop.lng != null) {
    distanceFromPrevKm = Math.round(haversineKm(prevStop.lat, prevStop.lng, currentStop.lat, currentStop.lng));
  }
  if (nextStop?.lat != null && nextStop.lng != null && currentStop?.lat != null && currentStop.lng != null) {
    distanceToNextKm = Math.round(haversineKm(currentStop.lat, currentStop.lng, nextStop.lat, nextStop.lng));
  }

  return {
    placeKey,
    label,
    placeId,
    dayNumbers,
    stayNights,
    visitBlocks: matchingBlocks.length,
    activityCount,
    latitude: currentStop?.lat,
    longitude: currentStop?.lng,
    distanceFromPrevKm,
    distanceToNextKm,
    prevPlaceLabel: prevBlock?.label,
    nextPlaceLabel: nextBlock?.label
  };
}

export function orderedPlaceStopsForSidebar(
  tripDays: TripDay[],
  placeById: (id: string) => Place | undefined
): Array<{ placeKey: string; label: string; placeId?: string; dayNumbers: number[] }> {
  const sortedDays = [...tripDays].filter((d) => !isPreTripDayRow(d)).sort((a, b) => a.dayNumber - b.dayNumber);
  const stops: OvernightStop[] = [];
  for (const day of sortedDays) {
    const stop = placeKeyForDay(day, placeById);
    if (stop) stops.push(stop);
  }
  return contiguousStayBlocks(stops);
}
