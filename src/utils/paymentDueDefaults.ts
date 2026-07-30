import type { ItineraryEntry } from '../models/ItineraryEntry';

/** Prefer explicit payment due, then booking due, then itinerary start date. */
export function deriveDefaultPaymentDueDate(entry: ItineraryEntry): string | undefined {
  const explicit = (entry.paymentDueDate || '').trim().slice(0, 10);
  if (explicit) return explicit;
  const bookingDue = (entry.bookingDueDate || '').trim().slice(0, 10);
  if (bookingDue) return bookingDue;
  const start = (entry.dateStart || '').trim().slice(0, 10);
  if (start) return start;
  const embarks = (entry.embarksDate || '').trim().slice(0, 10);
  return embarks || undefined;
}

export function effectivePaymentDueDate(entry: ItineraryEntry): string | undefined {
  return deriveDefaultPaymentDueDate(entry);
}
