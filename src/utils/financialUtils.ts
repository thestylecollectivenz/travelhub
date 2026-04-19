import type { ItineraryEntry } from '../models/ItineraryEntry';

function entryAmount(entry: ItineraryEntry): number {
  const n = entry.amount;
  return typeof n === 'number' && !Number.isNaN(n) ? n : 0;
}

/**
 * Sum itinerary line amounts filtered by coarse payment bucket.
 * Phase 3 will refine FX and partial paid splits; for now all amounts are NZD.
 *
 * - `all`: every entry
 * - `paid`: entries marked fully paid (contributes to “Spent So Far”)
 * - `unpaid`: not fully paid (not paid + part paid — contributes to “Remaining”)
 */
export function sumByPaymentStatus(
  entries: ItineraryEntry[],
  status: 'paid' | 'unpaid' | 'all'
): number {
  return entries.reduce((sum, entry) => {
    const amt = entryAmount(entry);
    if (status === 'all') {
      return sum + amt;
    }
    if (status === 'paid') {
      return entry.paymentStatus === 'Fully paid' ? sum + amt : sum;
    }
    return entry.paymentStatus !== 'Fully paid' ? sum + amt : sum;
  }, 0);
}

export function formatNZD(amount: number): string {
  return amount.toLocaleString('en-NZ', {
    style: 'currency',
    currency: 'NZD',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  });
}

export function avgPerDay(total: number, dayCount: number): number {
  if (dayCount <= 0) {
    return 0;
  }
  return total / dayCount;
}
