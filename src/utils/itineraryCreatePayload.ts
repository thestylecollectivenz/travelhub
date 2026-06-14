import type { ItineraryEntry } from '../models/ItineraryEntry';

/** Strip client-only / computed fields before SharePoint create. */
export function itineraryEntryCreatePayload(entry: ItineraryEntry): Omit<ItineraryEntry, 'id' | 'subItems'> {
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const { id, subItems, amountPaidConverted, paymentCurrency, ...payload } = entry;
  return payload;
}
