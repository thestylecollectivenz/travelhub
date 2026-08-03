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

function ymdShort(value?: string): string {
  if (!value) return '';
  const d = new Date(`${value.slice(0, 10)}T00:00:00.000Z`);
  if (Number.isNaN(d.getTime())) return value.slice(0, 10);
  return d.toLocaleDateString('en-NZ', { day: 'numeric', month: 'short', year: 'numeric' });
}

export function paymentTimingLabel(entry: Pick<ItineraryEntry, 'paymentDueType'>): string {
  return entry.paymentDueType === 'Automatic'
    ? 'Automatic — charged on this date'
    : 'Manual — pay by this date';
}

/**
 * Read-mode payment due line:
 * - Pay onsite when flagged
 * - otherwise payment timing + pay-by date (when present)
 */
export function paymentDueReadLabel(
  entry: Pick<ItineraryEntry, 'payOnsite' | 'paymentDueDate' | 'paymentDueType' | 'paymentStatus'>
): string | undefined {
  if (entry.paymentStatus === 'Fully paid' || entry.paymentStatus === 'Free') return undefined;
  if (entry.payOnsite === true) return 'Pay onsite';
  const date = ymdShort(entry.paymentDueDate);
  const timing = paymentDueActionLabel(entry);
  if (date) return `${timing} by ${date}`;
  if (entry.paymentDueType) return paymentTimingLabel(entry);
  return undefined;
}

/** Separate timing label for detail grids when not pay-onsite. */
export function paymentTimingReadLabel(
  entry: Pick<ItineraryEntry, 'payOnsite' | 'paymentDueType' | 'paymentStatus'>
): string | undefined {
  if (entry.paymentStatus === 'Fully paid' || entry.paymentStatus === 'Free') return undefined;
  if (entry.payOnsite === true) return undefined;
  if (!entry.paymentDueType) return undefined;
  return paymentTimingLabel(entry);
}

/** Pay-by date only (read mode) when not pay-onsite. */
export function payByDateReadLabel(
  entry: Pick<ItineraryEntry, 'payOnsite' | 'paymentDueDate' | 'paymentStatus'>
): string | undefined {
  if (entry.paymentStatus === 'Fully paid' || entry.paymentStatus === 'Free') return undefined;
  if (entry.payOnsite === true) return undefined;
  return ymdShort(entry.paymentDueDate) || undefined;
}
