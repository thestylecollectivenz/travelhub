import type { WebPartContext } from '@microsoft/sp-webpart-base';
import type { ItineraryEntry } from '../models/ItineraryEntry';
import type { Trip } from '../models/Trip';
import { ItineraryService } from '../services/ItineraryService';

export interface NearYouPlaceInput {
  name: string;
  note?: string;
  mapsUrl?: string;
  websiteUrl?: string;
}

export function buildItineraryEntryFromNearYouPlace(
  trip: Trip,
  dayId: string,
  place: NearYouPlaceInput,
  category = 'Activities'
): Omit<ItineraryEntry, 'id' | 'subItems'> {
  const noteParts = [place.note?.trim(), place.mapsUrl ? `Maps: ${place.mapsUrl}` : '', place.websiteUrl ? `Website: ${place.websiteUrl}` : '']
    .filter(Boolean)
    .join('\n');
  return {
    tripId: trip.id,
    dayId,
    title: place.name.trim(),
    category,
    location: place.note?.trim() || '',
    timeStart: '',
    duration: '',
    supplier: '',
    notes: noteParts,
    decisionStatus: 'Idea',
    bookingRequired: false,
    bookingStatus: 'Not booked',
    paymentStatus: 'Not paid',
    amount: 0,
    currency: 'NZD',
    sortOrder: 999
  };
}

export async function createItineraryEntryFromNearYouPlace(
  spContext: WebPartContext,
  trip: Trip,
  dayId: string,
  place: NearYouPlaceInput
): Promise<ItineraryEntry> {
  const itin = new ItineraryService(spContext);
  return itin.create(buildItineraryEntryFromNearYouPlace(trip, dayId, place));
}
