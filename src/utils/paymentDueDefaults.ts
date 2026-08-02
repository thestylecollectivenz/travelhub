import type { ItineraryEntry } from '../models/ItineraryEntry';

/**
 * Prefer explicit payment due, then booking due, then itinerary start date.
 * `paymentDueCleared` / empty cleared date means no due date.
 * `payOnsite` means pay at the venue — no payment-due task (independent of date).
 */
export function isPaymentDueCleared(entry: Pick<ItineraryEntry, 'paymentDueCleared' | 'paymentDueDate'>): boolean {
  if (entry.paymentDueCleared === true) return true;
  // Legacy sentinel from 229 (SharePoint rejects write; treat as cleared if still in memory).
  const d = (entry.paymentDueDate || '').trim().slice(0, 10);
  return d === '0001-01-01';
}

export function deriveDefaultPaymentDueDate(entry: ItineraryEntry): string | undefined {
  if (entry.payOnsite === true) return undefined;
  if (isPaymentDueCleared(entry)) return undefined;
  if (entry.paymentDueDate !== undefined && entry.paymentDueDate !== null) {
    const explicit = entry.paymentDueDate.trim().slice(0, 10);
    return explicit || undefined;
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

/** Hide from payments task list when marked pay-on-site. */
export function shouldHideFromPaymentTasks(entry: ItineraryEntry): boolean {
  return entry.payOnsite === true;
}

export function paymentDueDateInputValue(entry: ItineraryEntry): string {
  if (entry.payOnsite === true || isPaymentDueCleared(entry)) return '';
  if (entry.paymentDueDate !== undefined && entry.paymentDueDate !== null) {
    return entry.paymentDueDate.slice(0, 10);
  }
  return effectivePaymentDueDate(entry) || '';
}

/** Patch used when the user clears the due date. */
export function clearPaymentDuePatch(): Pick<ItineraryEntry, 'paymentDueDate' | 'paymentDueCleared'> {
  return { paymentDueDate: undefined, paymentDueCleared: true };
}

/** Patch used when the user sets an explicit due date. */
export function setPaymentDuePatch(ymd: string): Pick<ItineraryEntry, 'paymentDueDate' | 'paymentDueCleared'> {
  return { paymentDueDate: ymd, paymentDueCleared: false };
}
