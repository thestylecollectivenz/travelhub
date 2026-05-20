import * as React from 'react';
import { CategoryIcon } from '../shared/CategoryIcon';
import { useTripWorkspace } from '../../context/TripWorkspaceContext';
import { useConfig } from '../../context/ConfigContext';
import { getCategorySlug } from '../../utils/categoryUtils';
import {
  avgPerDay,
  BUDGET_CATEGORY_ORDER,
  formatCurrency,
  sumByPaymentStatus,
  type BudgetCategoryKey
} from '../../utils/financialUtils';
import { isPreTripDayRow } from '../../utils/itineraryDayEntries';
import { formatYmdDisplay, inclusiveDaysBetween, nightsBetween } from '../../utils/localDate';
import type { ItineraryEntry } from '../../models/ItineraryEntry';
import styles from './TripBudgetDetailView.module.css';

function bucketCategory(category: string): BudgetCategoryKey {
  if (category === 'Cruise port' || category === 'Cruise at sea') return 'Cruise';
  return BUDGET_CATEGORY_ORDER.some((k) => k === category) ? (category as BudgetCategoryKey) : 'Other';
}

interface DetailLine {
  id: string;
  title: string;
  dayLabel: string;
  dateLabel: string;
  spanLabel?: string;
  avgPerDay?: number;
  total: number;
  spent: number;
  remaining: number;
  isSubItem?: boolean;
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
    if (a && b) return `${a} - ${b}`;
  }
  if (entry.dateStart) return formatYmdDisplay(entry.dateStart);
  if (entry.embarksDate) return formatYmdDisplay(entry.embarksDate);
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

function buildCategoryLines(
  entries: ItineraryEntry[],
  category: BudgetCategoryKey,
  convertToHomeCurrency: (amount: number, currency: string) => number,
  dayLabelFor: (dayId: string) => string
): DetailLine[] {
  const lines: DetailLine[] = [];
  for (const entry of entries) {
    if (bucketCategory(entry.category) !== category) continue;
    const total = convertToHomeCurrency(entry.amount ?? 0, entry.currency || 'NZD');
    if (total > 0 || (entry.amount ?? 0) > 0) {
      const span = spanAndAvg(entry, total);
      const paid = entry.amountPaid !== undefined
        ? convertToHomeCurrency(entry.amountPaid, entry.paymentCurrency || entry.currency || 'NZD')
        : undefined;
      const spent = settledAmount(total, paid, entry.paymentStatus);
      lines.push({
        id: entry.id,
        title: entry.title || 'Untitled',
        dayLabel: dayLabelFor(entry.dayId),
        dateLabel: dateRangeLabel(entry) || dayLabelFor(entry.dayId),
        spanLabel: span.spanLabel,
        avgPerDay: span.avgPerDay,
        total,
        spent,
        remaining: Math.max(0, total - spent)
      });
    }
    for (const sub of entry.subItems ?? []) {
      const subTotal = convertToHomeCurrency(sub.amount ?? 0, sub.currency || 'NZD');
      if (subTotal > 0 || (sub.amount ?? 0) > 0) {
        const subPaid = sub.amountPaid !== undefined ? convertToHomeCurrency(sub.amountPaid, sub.currency || 'NZD') : undefined;
        const subSpent = settledAmount(subTotal, subPaid, sub.paymentStatus);
        lines.push({
          id: `${entry.id}-${sub.id}`,
          title: sub.title || 'Option',
          dayLabel: dayLabelFor(entry.dayId),
          dateLabel: dateRangeLabel(entry) || dayLabelFor(entry.dayId),
          total: subTotal,
          spent: subSpent,
          remaining: Math.max(0, subTotal - subSpent),
          isSubItem: true
        });
      }
    }
  }
  return lines.sort((a, b) => a.dayLabel.localeCompare(b.dayLabel) || a.title.localeCompare(b.title));
}

export const TripBudgetDetailView: React.FC = () => {
  const { trip, localEntries, tripDays, convertToHomeCurrency, selectedBudgetCategory } = useTripWorkspace();
  const { config } = useConfig();

  const entries = React.useMemo(
    () => (trip ? localEntries.filter((e) => e.tripId === trip.id) : []),
    [localEntries, trip]
  );

  const totalBudget = sumByPaymentStatus(entries, 'all', convertToHomeCurrency);
  const spentSoFar = sumByPaymentStatus(entries, 'paid', convertToHomeCurrency);
  const remaining = sumByPaymentStatus(entries, 'unpaid', convertToHomeCurrency);
  const tripDayCount = tripDays.filter((d) => trip && d.tripId === trip.id && !isPreTripDayRow(d)).length;
  const averagePerDay = avgPerDay(totalBudget, tripDayCount);

  const dayLabelFor = React.useCallback(
    (dayId: string): string => {
      const d = tripDays.find((x) => x.id === dayId);
      if (!d) return 'Day';
      if (d.dayType === 'PreTrip') return 'Pre-trip';
      return formatYmdDisplay(d.calendarDate) || `Day ${d.dayNumber}`;
    },
    [tripDays]
  );

  const category = selectedBudgetCategory ?? BUDGET_CATEGORY_ORDER[0];
  const detailLines = React.useMemo(
    () => buildCategoryLines(entries, category, convertToHomeCurrency, dayLabelFor),
    [entries, category, convertToHomeCurrency, dayLabelFor]
  );
  const categorySlug = getCategorySlug(category);
  const categoryTotal = detailLines.reduce((s, l) => s + l.total, 0);

  return (
    <section className={styles.root} aria-label="Trip budget detail">
      <header className={styles.header}>
        <h1 className={styles.title}>Trip budget</h1>
        <p className={styles.subtitle}>
          {tripDayCount} trip day{tripDayCount === 1 ? '' : 's'} · All figures in {config.homeCurrency}
        </p>
      </header>

      <div className={styles.summaryStrip} role="group" aria-label="Budget totals">
        <div className={styles.summaryChip}>
          <span className={styles.chipValue}>{formatCurrency(totalBudget, config.homeCurrency)}</span>
          <span className={styles.chipLabel}>Total budget</span>
        </div>
        <div className={styles.summaryChip}>
          <span className={styles.chipValue}>{formatCurrency(spentSoFar, config.homeCurrency)}</span>
          <span className={styles.chipLabel}>Spent so far</span>
        </div>
        <div className={styles.summaryChip}>
          <span className={styles.chipValue}>{formatCurrency(remaining, config.homeCurrency)}</span>
          <span className={styles.chipLabel}>Remaining</span>
        </div>
        <div className={styles.summaryChip}>
          <span className={styles.chipValue}>{formatCurrency(averagePerDay, config.homeCurrency)}</span>
          <span className={styles.chipLabel}>Avg per day</span>
        </div>
      </div>

      <header className={styles.categoryHeader}>
        <span className={`th-cat-${categorySlug} th-cat-icon`}>
          <CategoryIcon category={category} size={20} />
        </span>
        <h2 className={styles.sectionTitle}>{category}</h2>
        <span className={styles.categoryTotal}>{formatCurrency(categoryTotal, config.homeCurrency)}</span>
      </header>

      {detailLines.length === 0 ? (
        <p className={styles.emptyHint}>No line items with amounts in this category yet.</p>
      ) : (
        <div className={styles.lineList}>
          <div className={styles.lineHeader}>
            <span>Details</span>
            <span>Total budget</span>
            <span>Spent so far</span>
            <span>Remaining</span>
          </div>
          {detailLines.map((line) => (
            <div key={line.id} className={styles.lineRow}>
              <div className={styles.lineMain}>
                <span className={styles.lineTitle}>{line.isSubItem ? `-> ${line.title}` : line.title}</span>
                <span className={styles.lineMeta}>{line.dayLabel}</span>
                <span className={styles.lineMeta}>{line.dateLabel}</span>
                {line.spanLabel ? <span className={styles.lineMeta}>{line.spanLabel}</span> : null}
                {line.avgPerDay !== undefined && line.avgPerDay > 0 ? (
                  <span className={styles.lineMeta}>Avg {formatCurrency(line.avgPerDay, config.homeCurrency)} / day</span>
                ) : null}
              </div>
              <div className={styles.lineCols}>
                <span className={styles.lineAmount}>{formatCurrency(line.total, config.homeCurrency)}</span>
                <span className={styles.lineAmount}>{formatCurrency(line.spent, config.homeCurrency)}</span>
                <span className={styles.lineAmount}>{formatCurrency(line.remaining, config.homeCurrency)}</span>
              </div>
            </div>
          ))}
        </div>
      )}
    </section>
  );
};
