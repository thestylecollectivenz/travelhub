import type { ItineraryEntry } from '../models/ItineraryEntry';
import type { TripDay } from '../models/TripDay';
import {
  BUDGET_CATEGORY_ORDER,
  type BudgetCategoryKey
} from './financialUtils';
import { formatYmdDisplay, inclusiveDaysBetween, nightsBetween } from './localDate';

export type CostCertainty = 'Estimated' | 'Confirmed';

export interface BudgetDetailLine {
  id: string;
  entryId: string;
  title: string;
  dateLines: string[];
  spanLabel?: string;
  avgPerDay?: number;
  total: number;
  spent: number;
  remaining: number;
  costCertainty: CostCertainty;
  isSubItem?: boolean;
  sortKey: string;
}

function bucketCategory(category: string): BudgetCategoryKey {
  if (category === 'Cruise port' || category === 'Cruise at sea') return 'Cruise';
  return BUDGET_CATEGORY_ORDER.some((k) => k === category) ? (category as BudgetCategoryKey) : 'Other';
}

function dateRangeLabel(entry: ItineraryEntry): string | undefined {
  if (entry.dateStart && entry.dateEnd) {
    const a = formatYmdDisplay(entry.dateStart);
    const b = formatYmdDisplay(entry.dateEnd);
    if (a && b) return a === b ? a : `${a} - ${b}`;
  }
  if (entry.embarksDate && entry.disembarksDate) {
    const a = formatYmdDisplay(entry.embarksDate);
    const b = formatYmdDisplay(entry.disembarksDate);
    if (a && b) return a === b ? a : `${a} - ${b}`;
  }
  return undefined;
}

function spanAndAvg(entry: ItineraryEntry, amount: number): { spanLabel?: string; avgPerDay?: number } {
  if (entry.category === 'Accommodation' && entry.dateStart && entry.dateEnd) {
    const nights = nightsBetween(entry.dateStart, entry.dateEnd);
    if (nights > 0) return { spanLabel: `${nights} night${nights === 1 ? '' : 's'}`, avgPerDay: amount / nights };
  }
  if (entry.category === 'Cruise' && entry.embarksDate && entry.disembarksDate) {
    const days = inclusiveDaysBetween(entry.embarksDate, entry.disembarksDate);
    if (days > 0) return { spanLabel: `${days} day${days === 1 ? '' : 's'}`, avgPerDay: amount / days };
  }
  return {};
}

function settledAmount(total: number, paid: number | undefined, status: string): number {
  if (status === 'Fully paid') return total;
  if (status === 'Part paid') return Math.max(0, Math.min(total, paid ?? 0));
  return 0;
}

function sortKeyForEntry(entry: ItineraryEntry, tripDays: TripDay[]): string {
  if (entry.dateStart) return entry.dateStart;
  if (entry.embarksDate) return entry.embarksDate;
  const day = tripDays.find((d) => d.id === entry.dayId);
  return day?.calendarDate?.slice(0, 10) || '9999-12-31';
}

function dateLinesForEntry(entry: ItineraryEntry, dayLabel: string): string[] {
  const range = dateRangeLabel(entry);
  if (range) {
    const lines: string[] = [range];
    return lines;
  }
  if (dayLabel) return [dayLabel];
  return [];
}

function normalizeCostCertainty(v?: string): CostCertainty {
  return v === 'Estimated' ? 'Estimated' : 'Confirmed';
}

export function buildBudgetDetailLines(
  entries: ItineraryEntry[],
  category: BudgetCategoryKey,
  convertToHomeCurrency: (amount: number, currency: string) => number,
  dayLabelFor: (dayId: string) => string,
  tripDays: TripDay[]
): BudgetDetailLine[] {
  const lines: BudgetDetailLine[] = [];
  for (const entry of entries) {
    if (bucketCategory(entry.category) !== category) continue;
    const total = convertToHomeCurrency(entry.amount ?? 0, entry.currency || 'NZD');
    if (total > 0 || (entry.amount ?? 0) > 0) {
      const span = spanAndAvg(entry, total);
      const paid =
        entry.amountPaid !== undefined
          ? convertToHomeCurrency(entry.amountPaid, entry.paymentCurrency || entry.currency || 'NZD')
          : undefined;
      const spent = settledAmount(total, paid, entry.paymentStatus);
      const dayLabel = dayLabelFor(entry.dayId);
      lines.push({
        id: entry.id,
        entryId: entry.id,
        title: entry.title || 'Untitled',
        dateLines: dateLinesForEntry(entry, dayLabel),
        spanLabel: span.spanLabel,
        avgPerDay: span.avgPerDay,
        total,
        spent,
        remaining: Math.max(0, total - spent),
        costCertainty: normalizeCostCertainty(entry.costCertainty),
        sortKey: sortKeyForEntry(entry, tripDays)
      });
    }
    for (const sub of entry.subItems ?? []) {
      const subTotal = convertToHomeCurrency(sub.amount ?? 0, sub.currency || 'NZD');
      if (subTotal > 0 || (sub.amount ?? 0) > 0) {
        const subPaid = sub.amountPaid !== undefined ? convertToHomeCurrency(sub.amountPaid, sub.currency || 'NZD') : undefined;
        const subSpent = settledAmount(subTotal, subPaid, sub.paymentStatus);
        lines.push({
          id: `${entry.id}-${sub.id}`,
          entryId: entry.id,
          title: sub.title || 'Option',
          dateLines: dateLinesForEntry(entry, dayLabelFor(entry.dayId)),
          total: subTotal,
          spent: subSpent,
          remaining: Math.max(0, subTotal - subSpent),
          costCertainty: normalizeCostCertainty(sub.costCertainty),
          isSubItem: true,
          sortKey: sortKeyForEntry(entry, tripDays)
        });
      }
    }
  }
  return lines.sort((a, b) => a.sortKey.localeCompare(b.sortKey) || a.title.localeCompare(b.title));
}

export function sumBudgetLines(lines: BudgetDetailLine[]): { total: number; spent: number; remaining: number } {
  return lines.reduce(
    (acc, l) => ({
      total: acc.total + l.total,
      spent: acc.spent + l.spent,
      remaining: acc.remaining + l.remaining
    }),
    { total: 0, spent: 0, remaining: 0 }
  );
}

export { bucketCategory };
