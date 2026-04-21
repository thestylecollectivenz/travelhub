import type { ItineraryEntry, ItineraryPaymentStatus } from '../models/ItineraryEntry';

function entryAmount(entry: ItineraryEntry): number {
  const n = entry.amount;
  return typeof n === 'number' && !Number.isNaN(n) ? n : 0;
}

interface FinancialLine {
  amount: number;
  amountPaid?: number;
  paymentStatus: ItineraryPaymentStatus;
  category: string;
  dayId: string;
}

function getFinancialLines(entries: ItineraryEntry[]): FinancialLine[] {
  const lines: FinancialLine[] = [];
  for (const entry of entries) {
    lines.push({
      amount: entryAmount(entry),
      amountPaid: entry.amountPaid,
      paymentStatus: entry.paymentStatus,
      category: entry.category,
      dayId: entry.dayId
    });
    const subItems = entry.subItems ?? [];
    for (const sub of subItems) {
      const amount = typeof sub.amount === 'number' && !Number.isNaN(sub.amount) ? sub.amount : 0;
      lines.push({
        amount,
        amountPaid: sub.amountPaid,
        paymentStatus: sub.paymentStatus,
        category: entry.category,
        dayId: entry.dayId
      });
    }
  }
  return lines;
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
  const lines = getFinancialLines(entries);
  return lines.reduce((sum, line) => {
    if (line.paymentStatus === 'Free') {
      return sum;
    }

    if (status === 'all') {
      return sum + line.amount;
    }

    if (line.paymentStatus === 'Fully paid') {
      return status === 'paid' ? sum + line.amount : sum;
    }

    if (line.paymentStatus === 'Part paid') {
      const paid = Math.min(line.amount, line.amountPaid ?? 0);
      const unpaid = line.amount - paid;
      if (status === 'paid') {
        return sum + paid;
      }
      if (status === 'unpaid') {
        return sum + unpaid;
      }
    }

    if (line.paymentStatus === 'Not paid') {
      return status === 'unpaid' ? sum + line.amount : sum;
    }

    return sum;
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
  'Travel Overheads',
  'Preparation',
  'Other'
] as const;

export type BudgetCategoryKey = (typeof BUDGET_CATEGORY_ORDER)[number];

function isBudgetCategoryKey(value: string): value is BudgetCategoryKey {
  return BUDGET_CATEGORY_ORDER.some((k) => k === value);
}

/** Whole-trip totals keyed by category (always all six keys). */
export function sumByCategory(entries: ItineraryEntry[]): Record<string, number> {
  const lines = getFinancialLines(entries);
  const result: Record<string, number> = {};
  for (const key of BUDGET_CATEGORY_ORDER) {
    result[key] = 0;
  }
  for (const line of lines) {
    const bucket: BudgetCategoryKey = isBudgetCategoryKey(line.category) ? line.category : 'Other';
    result[bucket] = (result[bucket] ?? 0) + line.amount;
  }
  return result;
}

/** Sum of line amounts for one calendar day. */
export function sumForDay(entries: ItineraryEntry[], dayId: string): number {
  const lines = getFinancialLines(entries);
  return lines.reduce((sum, line) => {
    if (line.dayId !== dayId) {
      return sum;
    }
    return sum + line.amount;
  }, 0);
}

function bucketCategory(category: string): BudgetCategoryKey {
  return isBudgetCategoryKey(category) ? category : 'Other';
}

/** Category totals for one day only (all six keys; unused stay 0). */
export function sumForDayByCategory(entries: ItineraryEntry[], dayId: string): Record<string, number> {
  const lines = getFinancialLines(entries);
  const result: Record<string, number> = {};
  for (const key of BUDGET_CATEGORY_ORDER) {
    result[key] = 0;
  }
  for (const line of lines) {
    if (line.dayId !== dayId) {
      continue;
    }
    const bucket = bucketCategory(line.category);
    result[bucket] = (result[bucket] ?? 0) + line.amount;
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
  const lines = getFinancialLines(entries);
  const bucket = bucketCategory(category);
  let paid = 0;
  let unpaid = 0;
  let itemCount = 0;
  for (const line of lines) {
    if (line.dayId !== dayId) {
      continue;
    }
    if (bucketCategory(line.category) !== bucket) {
      continue;
    }
    itemCount++;
    if (line.paymentStatus === 'Free') {
      continue;
    }
    if (line.paymentStatus === 'Fully paid') {
      paid += line.amount;
    } else if (line.paymentStatus === 'Part paid') {
      const paidPart = line.amountPaid ?? 0;
      paid += paidPart;
      unpaid += line.amount - paidPart;
    } else {
      unpaid += line.amount;
    }
  }
  return {
    paid,
    unpaid,
    total: paid + unpaid,
    itemCount
  };
}
