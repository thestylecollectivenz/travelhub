import type { ItineraryEntry, ItineraryPaymentStatus } from '../models/ItineraryEntry';

function entryAmount(entry: ItineraryEntry): number {
  const n = entry.amount;
  return typeof n === 'number' && !Number.isNaN(n) ? n : 0;
}

function nightsForAccommodation(entry: ItineraryEntry): number {
  if (entry.category !== 'Accommodation' || !entry.dateStart || !entry.dateEnd) return 0;
  const start = new Date(`${entry.dateStart}T00:00:00.000Z`);
  const end = new Date(`${entry.dateEnd}T00:00:00.000Z`);
  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) return 0;
  const diff = Math.floor((end.getTime() - start.getTime()) / 86400000);
  return diff > 0 ? diff : 0;
}

function isAccommodationOnDate(entry: ItineraryEntry, dayCalendarDate?: string): boolean {
  if (!dayCalendarDate) return false;
  if (entry.category !== 'Accommodation' || !entry.dateStart || !entry.dateEnd) return false;
  const day = new Date(`${dayCalendarDate}T00:00:00.000Z`);
  const start = new Date(`${entry.dateStart}T00:00:00.000Z`);
  const end = new Date(`${entry.dateEnd}T00:00:00.000Z`);
  if (Number.isNaN(day.getTime()) || Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) return false;
  return day.getTime() >= start.getTime() && day.getTime() < end.getTime();
}

function daysForCruise(entry: ItineraryEntry): number {
  if (entry.category !== 'Cruise' || !entry.embarksDate || !entry.disembarksDate) return 0;
  const start = new Date(`${entry.embarksDate}T00:00:00.000Z`);
  const end = new Date(`${entry.disembarksDate}T00:00:00.000Z`);
  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) return 0;
  const diff = Math.floor((end.getTime() - start.getTime()) / 86400000) + 1;
  return diff > 0 ? diff : 0;
}

function isCruiseOnDate(entry: ItineraryEntry, dayCalendarDate?: string): boolean {
  if (!dayCalendarDate) return false;
  if (entry.category !== 'Cruise' || !entry.embarksDate || !entry.disembarksDate) return false;
  const day = new Date(`${dayCalendarDate}T00:00:00.000Z`);
  const start = new Date(`${entry.embarksDate}T00:00:00.000Z`);
  const end = new Date(`${entry.disembarksDate}T00:00:00.000Z`);
  if (Number.isNaN(day.getTime()) || Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) return false;
  return day.getTime() >= start.getTime() && day.getTime() <= end.getTime();
}

function appliesToDay(entry: ItineraryEntry, dayId: string, dayCalendarDate?: string): boolean {
  if (entry.dayId === dayId) return true;
  return isAccommodationOnDate(entry, dayCalendarDate) || isCruiseOnDate(entry, dayCalendarDate);
}

interface FinancialLine {
  amount: number;
  amountPaid?: number;
  paymentStatus: ItineraryPaymentStatus;
  category: string;
  dayId: string;
}

export type CurrencyConverter = (amount: number, currency: string) => number;

const identityConverter: CurrencyConverter = (amount) => amount;

function getFinancialLines(
  entries: ItineraryEntry[],
  converter: CurrencyConverter = identityConverter,
  dayId?: string,
  dayCalendarDate?: string
): FinancialLine[] {
  const lines: FinancialLine[] = [];
  for (const entry of entries) {
    if (dayId && !appliesToDay(entry, dayId, dayCalendarDate)) {
      continue;
    }
    const currency = entry.currency || 'NZD';
    const fullAmount = entryAmount(entry);
    const nights = nightsForAccommodation(entry);
    const cruiseDays = daysForCruise(entry);
    const splitDivisor = nights > 0 ? nights : cruiseDays > 0 ? cruiseDays : 0;
    const splitAmount = dayId && splitDivisor > 0 ? fullAmount / splitDivisor : fullAmount;
    const amount = converter(splitAmount, currency);
    const amountPaid = entry.amountPaid !== undefined
      ? (typeof entry.amountPaidConverted === 'number'
          ? (dayId && splitDivisor > 0 ? entry.amountPaidConverted / splitDivisor : entry.amountPaidConverted)
          : converter(dayId && splitDivisor > 0 ? entry.amountPaid / splitDivisor : entry.amountPaid, entry.paymentCurrency || currency))
      : undefined;
    const lineDayId = dayId ?? entry.dayId;
    lines.push({
      amount,
      amountPaid,
      paymentStatus: entry.paymentStatus,
      category: entry.category,
      dayId: lineDayId
    });
    const subItems = entry.subItems ?? [];
    for (const sub of subItems) {
      const subCurrency = sub.currency || 'NZD';
      const subAmount = typeof sub.amount === 'number' && !Number.isNaN(sub.amount)
        ? converter(sub.amount, subCurrency)
        : 0;
      const subAmountPaid = sub.amountPaid !== undefined
        ? converter(sub.amountPaid, subCurrency)
        : undefined;
      lines.push({
        amount: subAmount,
        amountPaid: subAmountPaid,
        paymentStatus: sub.paymentStatus,
        category: entry.category,
        dayId: lineDayId
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
  status: 'paid' | 'unpaid' | 'all',
  converter: CurrencyConverter = identityConverter
): number {
  const lines = getFinancialLines(entries, converter);
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

export function formatCurrency(amount: number, currency: string): string {
  const code = (currency || 'NZD').toUpperCase();
  return amount.toLocaleString('en-NZ', {
    style: 'currency',
    currency: code,
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
  'Cruise',
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

function bucketCategory(category: string): BudgetCategoryKey {
  if (category === 'Cruise port' || category === 'Cruise at sea') {
    return 'Cruise';
  }
  return isBudgetCategoryKey(category) ? category : 'Other';
}

/** Whole-trip totals keyed by category (always all six keys). */
export function sumByCategory(
  entries: ItineraryEntry[],
  converter: CurrencyConverter = identityConverter
): Record<string, number> {
  const lines = getFinancialLines(entries, converter);
  const result: Record<string, number> = {};
  for (const key of BUDGET_CATEGORY_ORDER) {
    result[key] = 0;
  }
  for (const line of lines) {
    const bucket = bucketCategory(line.category);
    result[bucket] = (result[bucket] ?? 0) + line.amount;
  }
  return result;
}

/** Sum of line amounts for one calendar day. */
export function sumForDay(
  entries: ItineraryEntry[],
  dayId: string,
  converter: CurrencyConverter = identityConverter,
  dayCalendarDate?: string
): number {
  const lines = getFinancialLines(entries, converter, dayId, dayCalendarDate);
  return lines.reduce((sum, line) => {
    if (line.dayId !== dayId) {
      return sum;
    }
    return sum + line.amount;
  }, 0);
}

/** Category totals for one day only (all six keys; unused stay 0). */
export function sumForDayByCategory(
  entries: ItineraryEntry[],
  dayId: string,
  converter: CurrencyConverter = identityConverter,
  dayCalendarDate?: string
): Record<string, number> {
  const lines = getFinancialLines(entries, converter, dayId, dayCalendarDate);
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
  category: string,
  converter: CurrencyConverter = identityConverter,
  dayCalendarDate?: string
): DayCategoryPaymentSummary {
  const lines = getFinancialLines(entries, converter, dayId, dayCalendarDate);
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
