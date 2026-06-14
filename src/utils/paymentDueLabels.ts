import type { ItineraryEntry } from '../models/ItineraryEntry';

export function paymentDueActionLabel(entry: Pick<ItineraryEntry, 'paymentDueType'>): string {
  return entry.paymentDueType === 'Automatic' ? 'Auto-charge' : 'Pay';
}

export function paymentDueTaskTitle(entry: Pick<ItineraryEntry, 'title' | 'paymentDueType'>): string {
  const label = paymentDueActionLabel(entry);
  return `${label}: ${entry.title || 'Untitled'}`;
}

export function paymentDueDateHint(entry: Pick<ItineraryEntry, 'paymentDueType'>): string {
  return entry.paymentDueType === 'Automatic'
    ? 'Payment will be taken automatically on this date'
    : 'You need to put through payment by this date';
}
