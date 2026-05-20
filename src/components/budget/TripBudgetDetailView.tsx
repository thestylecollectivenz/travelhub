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
import type { ItineraryEntry } from '../../models/ItineraryEntry';
import styles from './TripBudgetDetailView.module.css';

function bucketCategory(category: string): BudgetCategoryKey {
  if (category === 'Cruise port' || category === 'Cruise at sea') {
    return 'Cruise';
  }
  return BUDGET_CATEGORY_ORDER.some((k) => k === category) ? (category as BudgetCategoryKey) : 'Other';
}

interface DetailLine {
  id: string;
  title: string;
  dayLabel: string;
  amount: number;
  paymentStatus: string;
  isSubItem?: boolean;
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
    const amt = convertToHomeCurrency(entry.amount ?? 0, entry.currency || 'NZD');
    if (amt > 0 || (entry.amount ?? 0) > 0) {
      lines.push({
        id: entry.id,
        title: entry.title || 'Untitled',
        dayLabel: dayLabelFor(entry.dayId),
        amount: amt,
        paymentStatus: entry.paymentStatus
      });
    }
    for (const sub of entry.subItems ?? []) {
      const subAmt = convertToHomeCurrency(sub.amount ?? 0, sub.currency || 'NZD');
      if (subAmt > 0 || (sub.amount ?? 0) > 0) {
        lines.push({
          id: `${entry.id}-${sub.id}`,
          title: sub.title || 'Option',
          dayLabel: dayLabelFor(entry.dayId),
          amount: subAmt,
          paymentStatus: sub.paymentStatus,
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
    (dayId: string) => {
      const d = tripDays.find((x) => x.id === dayId);
      if (!d) return 'Day';
      const date = (d.calendarDate || '').slice(0, 10);
      return d.displayTitle || date || `Day ${d.dayNumber}`;
    },
    [tripDays]
  );

  const category = selectedBudgetCategory ?? BUDGET_CATEGORY_ORDER[0];
  const detailLines = React.useMemo(
    () => buildCategoryLines(entries, category, convertToHomeCurrency, dayLabelFor),
    [entries, category, convertToHomeCurrency, dayLabelFor]
  );
  const categorySlug = getCategorySlug(category);
  const categoryTotal = detailLines.reduce((s, l) => s + l.amount, 0);

  return (
    <section className={styles.root} aria-label="Trip budget detail">
      <header className={styles.header}>
        <h1 className={styles.title}>Trip budget</h1>
        <p className={styles.subtitle}>
          {tripDayCount} trip day{tripDayCount === 1 ? '' : 's'} · All figures in {config.homeCurrency}
        </p>
      </header>

      <div className={styles.summaryStrip}>
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
          {detailLines.map((line) => (
            <div key={line.id} className={styles.lineRow}>
              <div className={styles.lineMain}>
                <span className={styles.lineTitle}>
                  {line.isSubItem ? `↳ ${line.title}` : line.title}
                </span>
                <span className={styles.lineMeta}>{line.dayLabel}</span>
              </div>
              <div className={styles.lineRight}>
                <span className={styles.lineAmount}>{formatCurrency(line.amount, config.homeCurrency)}</span>
                <span className={styles.lineStatus}>{line.paymentStatus}</span>
              </div>
            </div>
          ))}
        </div>
      )}
    </section>
  );
};
