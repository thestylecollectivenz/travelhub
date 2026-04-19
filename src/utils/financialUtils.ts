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

/** Canonical budget categories — unknown `entry.category` rolls into `Other`. */
export const BUDGET_CATEGORY_ORDER = [
  'Flights',
  'Accommodation',
  'Food & Dining',
  'Activities',
  'Transport',
  'Other'
] as const;

export type BudgetCategoryKey = (typeof BUDGET_CATEGORY_ORDER)[number];

function isBudgetCategoryKey(value: string): value is BudgetCategoryKey {
  return BUDGET_CATEGORY_ORDER.some((k) => k === value);
}

/** Whole-trip totals keyed by category (always all six keys). */
export function sumByCategory(entries: ItineraryEntry[]): Record<string, number> {
  const result: Record<string, number> = {};
  for (const key of BUDGET_CATEGORY_ORDER) {
    result[key] = 0;
  }
  for (const entry of entries) {
    const bucket: BudgetCategoryKey = isBudgetCategoryKey(entry.category) ? entry.category : 'Other';
    result[bucket] = (result[bucket] ?? 0) + entryAmount(entry);
  }
  return result;
}

/** Sum of line amounts for one calendar day. */
export function sumForDay(entries: ItineraryEntry[], dayId: string): number {
  return entries.reduce((sum, entry) => {
    if (entry.dayId !== dayId) {
      return sum;
    }
    return sum + entryAmount(entry);
  }, 0);
}

function bucketCategory(category: string): BudgetCategoryKey {
  return isBudgetCategoryKey(category) ? category : 'Other';
}

/** Category totals for one day only (all six keys; unused stay 0). */
export function sumForDayByCategory(entries: ItineraryEntry[], dayId: string): Record<string, number> {
  const result: Record<string, number> = {};
  for (const key of BUDGET_CATEGORY_ORDER) {
    result[key] = 0;
  }
  for (const entry of entries) {
    if (entry.dayId !== dayId) {
      continue;
    }
    const bucket = bucketCategory(entry.category);
    result[bucket] = (result[bucket] ?? 0) + entryAmount(entry);
  }
  return result;
}

export interface DayCategoryPaymentSummary {
  paid: number;
  unpaid: number;
  total: number;
  itemCount: number;
}

/**
 * Paid / unpaid / total / count for one day and one budget category (`category` is normalized like `sumByCategory`).
 */
export function getPaymentSummaryForDayCategory(
  entries: ItineraryEntry[],
  dayId: string,
  category: string
): DayCategoryPaymentSummary {
  const bucket = bucketCategory(category);
  let paid = 0;
  let unpaid = 0;
  let itemCount = 0;
  for (const entry of entries) {
    if (entry.dayId !== dayId) {
      continue;
    }
    if (bucketCategory(entry.category) !== bucket) {
      continue;
    }
    itemCount++;
    const amt = entryAmount(entry);
    if (entry.paymentStatus === 'Fully paid') {
      paid += amt;
    } else {
      unpaid += amt;
    }
  }
  return {
    paid,
    unpaid,
    total: paid + unpaid,
    itemCount
  };
}
