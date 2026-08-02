import type { ItineraryEntry } from '../models/ItineraryEntry';

/** Stored YYYY-MM-DD meaning the user cleared the payment due date (no due date). */
export const PAYMENT_DUE_NONE = '0001-01-01';

export function isPaymentDueCleared(entry: Pick<ItineraryEntry, 'paymentDueDate'>): boolean {
  if (entry.paymentDueDate === undefined || entry.paymentDueDate === null) return false;
  const d = entry.paymentDueDate.trim().slice(0, 10);
  return !d || d === PAYMENT_DUE_NONE;
}

/**
 * Prefer explicit payment due, then booking due, then itinerary start date.
 * Cleared dates (`''` / PAYMENT_DUE_NONE) mean no due date.
 * `undefined` means unset — derive a default from the itinerary item.
 */
export function deriveDefaultPaymentDueDate(entry: ItineraryEntry): string | undefined {
  if (entry.paymentDueDate !== undefined && entry.paymentDueDate !== null) {
    if (isPaymentDueCleared(entry)) return undefined;
    return entry.paymentDueDate.trim().slice(0, 10) || undefined;
  }
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

/** Manual payments due on the same calendar day as the itinerary item itself. */
export function isManualSameDayPayment(entry: ItineraryEntry): boolean {
  if ((entry.paymentDueType || 'Manual') !== 'Manual') return false;
  const due = effectivePaymentDueDate(entry);
  if (!due) return false;
  const itemDate =
    (entry.dateStart || '').trim().slice(0, 10) ||
    (entry.embarksDate || '').trim().slice(0, 10);
  return Boolean(itemDate && due === itemDate);
}

export function paymentDueDateInputValue(entry: ItineraryEntry): string {
  if (entry.paymentDueDate !== undefined && entry.paymentDueDate !== null) {
    if (isPaymentDueCleared(entry)) return '';
    return entry.paymentDueDate.slice(0, 10);
  }
  return effectivePaymentDueDate(entry) || '';
}
