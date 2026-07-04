import type { ItineraryEntry, ItineraryPaymentStatus, ItinerarySubItem } from '../models/ItineraryEntry';
import { isLocationInfoEntry } from './locationInfoEntry';

export function entryAmountMissing(amount: number | undefined | null): boolean {
  if (amount === undefined || amount === null) return true;
  if (typeof amount !== 'number' || Number.isNaN(amount)) return true;
  return amount <= 0;
}

/** True when a cost is expected but not entered (Free items never need a cost). */
export function needsCostEntered(
  amount: number | undefined | null,
  paymentStatus: ItineraryPaymentStatus | undefined
): boolean {
  if (paymentStatus === 'Free') return false;
  return entryAmountMissing(amount);
}

export interface MissingAmountRow {
  /** Stable id for dismiss / list key (entry id or option id). */
  id: string;
  /** Parent itinerary card to open in the day view. */
  openEntryId: string;
  dayId: string;
  title: string;
  category: string;
  supplier?: string;
  /** Option under a parent card. */
  isOption: boolean;
  parentTitle?: string;
  /** Cruise port only: summary of option cost status. */
  optionCostSummary?: string;
}

function optionCostSummary(subs: ItinerarySubItem[]): string | undefined {
  if (!subs.length) return 'No options';
  const reviewable = subs.filter((s) => s.paymentStatus !== 'Free');
  if (!reviewable.length) return 'All options marked Free';
  const missing = reviewable.filter((s) => entryAmountMissing(s.amount));
  const withCost = reviewable.length - missing.length;
  if (missing.length === 0) return `All ${reviewable.length} option${reviewable.length === 1 ? '' : 's'} have costs`;
  if (withCost === 0) {
    return `${missing.length} option${missing.length === 1 ? '' : 's'} missing costs`;
  }
  return `${missing.length} of ${reviewable.length} options missing costs`;
}

/**
 * Itinerary cards and options that still need a cost entered.
 * Excludes Location info and Free items. Options are listed separately.
 * Cruise ports that need a cost include an options cost summary.
 */
export function collectMissingAmountRows(entries: ItineraryEntry[]): MissingAmountRow[] {
  const rows: MissingAmountRow[] = [];

  for (const entry of entries) {
    if (entry.parentEntryId) continue;
    if (isLocationInfoEntry(entry)) continue;

    const isCruisePort = (entry.category || '').trim() === 'Cruise port';
    const subs = entry.subItems ?? [];

    if (needsCostEntered(entry.amount, entry.paymentStatus)) {
      rows.push({
        id: entry.id,
        openEntryId: entry.id,
        dayId: entry.dayId,
        title: entry.title || 'Untitled',
        category: entry.category || 'Other',
        supplier: entry.supplier?.trim() || undefined,
        isOption: false,
        optionCostSummary: isCruisePort ? optionCostSummary(subs) : undefined
      });
    }

    for (const sub of subs) {
      if (!needsCostEntered(sub.amount, sub.paymentStatus)) continue;
      rows.push({
        id: sub.id,
        openEntryId: entry.id,
        dayId: entry.dayId,
        title: sub.title || 'Untitled option',
        category: (sub.category || entry.category || 'Other').trim(),
        supplier: sub.supplier?.trim() || entry.supplier?.trim() || undefined,
        isOption: true,
        parentTitle: entry.title || 'Untitled'
      });
    }
  }

  return rows;
}

export function countMissingAmountRows(entries: ItineraryEntry[]): number {
  return collectMissingAmountRows(entries).length;
}
