import * as React from 'react';
import { CategoryIcon } from '../shared/CategoryIcon';
import { useTripWorkspace } from '../../context/TripWorkspaceContext';
import { useConfig } from '../../context/ConfigContext';
import { getCategorySlug } from '../../utils/categoryUtils';
import {
  avgPerDay,
  BUDGET_CATEGORY_ORDER,
  formatCurrency,
  sumByPaymentStatus
} from '../../utils/financialUtils';
import { isPreTripDayRow } from '../../utils/itineraryDayEntries';
import { formatYmdDisplay } from '../../utils/localDate';
import {
  buildBudgetDetailLines,
  sumBudgetLines,
  type BudgetDetailLine
} from '../../utils/budgetDetailLines';
import { buildBudgetPrintHtml, exportFullBudgetToExcel } from '../../utils/exportBudgetExcel';
import { BudgetPrintSheet } from './BudgetPrintSheet';
import styles from './TripBudgetDetailView.module.css';

type BudgetViewMode = 'category' | 'all';

function BudgetLineTable({
  lines,
  homeCurrency,
  onEditEntry
}: {
  lines: BudgetDetailLine[];
  homeCurrency: string;
  onEditEntry: (entryId: string) => void;
}): React.ReactElement {
  const totals = sumBudgetLines(lines);
  if (!lines.length) {
    return <p className={styles.emptyHint}>No line items with amounts in this category yet.</p>;
  }
  return (
    <div className={styles.lineList}>
      <div className={styles.lineHeader}>
        <span>Details</span>
        <span className={styles.colMoney}>Total budget</span>
        <span className={styles.colMoney}>Spent so far</span>
        <span className={styles.colMoney}>Remaining</span>
      </div>
      <div className={`${styles.lineRow} ${styles.lineTotalsRow}`}>
        <span className={styles.totalsLabel}>Totals</span>
        <span className={`${styles.lineAmount} ${styles.colMoney}`}>{formatCurrency(totals.total, homeCurrency)}</span>
        <span className={`${styles.lineAmount} ${styles.colMoney}`}>{formatCurrency(totals.spent, homeCurrency)}</span>
        <span className={`${styles.lineAmount} ${styles.colMoney}`}>{formatCurrency(totals.remaining, homeCurrency)}</span>
      </div>
      {lines.map((line) => (
        <div
          key={line.id}
          className={`${styles.lineRow} ${line.costCertainty === 'Estimated' ? styles.lineEstimated : styles.lineConfirmed}`}
        >
          <div className={styles.lineMain}>
            <span className={styles.lineTitle}>
              {line.isSubItem ? `→ ${line.title}` : line.title}
              <button type="button" className={styles.editLink} onClick={() => onEditEntry(line.entryId)}>
                Edit
              </button>
            </span>
            {line.dateLines.map((d) => (
              <span key={d} className={styles.lineMeta}>
                {d}
              </span>
            ))}
            {line.spanLabel ? <span className={styles.lineMeta}>{line.spanLabel}</span> : null}
            {line.avgPerDay !== undefined && line.avgPerDay > 0 ? (
              <span className={styles.lineMeta}>Avg {formatCurrency(line.avgPerDay, homeCurrency)} / day</span>
            ) : null}
          </div>
          <span className={`${styles.lineAmount} ${styles.colMoney}`}>{formatCurrency(line.total, homeCurrency)}</span>
          <span className={`${styles.lineAmount} ${styles.colMoney}`}>{formatCurrency(line.spent, homeCurrency)}</span>
          <span className={`${styles.lineAmount} ${styles.colMoney}`}>{formatCurrency(line.remaining, homeCurrency)}</span>
        </div>
      ))}
    </div>
  );
}

export const TripBudgetDetailView: React.FC = () => {
  const {
    trip,
    localEntries,
    tripDays,
    convertToHomeCurrency,
    selectedBudgetCategory,
    setSelectedBudgetCategory,
    setSelectedDayId,
    setEditingCardId,
    setFocusedEntryId,
    setMainWorkspaceTab
  } = useTripWorkspace();
  const { config } = useConfig();
  const [viewMode, setViewMode] = React.useState<BudgetViewMode>('category');
  const [printHtml, setPrintHtml] = React.useState<string | null>(null);

  React.useEffect(() => {
    if (selectedBudgetCategory) {
      setViewMode('category');
    }
  }, [selectedBudgetCategory]);

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

  const openEntryForEdit = React.useCallback(
    (entryId: string): void => {
      const entry = localEntries.find((e) => e.id === entryId);
      if (!entry) return;
      setMainWorkspaceTab('itinerary');
      setSelectedDayId(entry.dayId);
      setFocusedEntryId(null);
      setEditingCardId(entryId);
    },
    [localEntries, setEditingCardId, setFocusedEntryId, setMainWorkspaceTab, setSelectedDayId]
  );

  const category = selectedBudgetCategory ?? BUDGET_CATEGORY_ORDER[0];
  const categoryLines = React.useMemo(
    () => buildBudgetDetailLines(entries, category, convertToHomeCurrency, dayLabelFor, tripDays),
    [entries, category, convertToHomeCurrency, dayLabelFor, tripDays]
  );
  const categorySlug = getCategorySlug(category);

  const printBudget = React.useCallback((): void => {
    if (!trip) return;
    const html = buildBudgetPrintHtml({
      tripTitle: trip.title,
      homeCurrency: config.homeCurrency,
      tripDayCount,
      totalBudget,
      spentSoFar,
      remaining,
      averagePerDay,
      entries,
      tripDays,
      convertToHomeCurrency,
      dayLabelFor
    });
    setPrintHtml(html);
  }, [
    trip,
    config.homeCurrency,
    tripDayCount,
    totalBudget,
    spentSoFar,
    remaining,
    averagePerDay,
    entries,
    tripDays,
    convertToHomeCurrency,
    dayLabelFor
  ]);

  const exportExcel = React.useCallback((): void => {
    if (!trip) return;
    exportFullBudgetToExcel({
      trip,
      entries,
      tripDays,
      homeCurrency: config.homeCurrency,
      convertToHomeCurrency,
      dayLabelFor
    });
  }, [trip, entries, tripDays, config.homeCurrency, convertToHomeCurrency, dayLabelFor]);

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

      <div className={styles.toolbar}>
        <div className={styles.segment} role="group" aria-label="Budget view">
          <button
            type="button"
            className={`${styles.segmentBtn} ${viewMode === 'category' ? styles.segmentActive : ''}`}
            onClick={() => setViewMode('category')}
          >
            By category
          </button>
          <button
            type="button"
            className={`${styles.segmentBtn} ${viewMode === 'all' ? styles.segmentActive : ''}`}
            onClick={() => {
              setViewMode('all');
              setSelectedBudgetCategory(null);
            }}
          >
            All categories
          </button>
        </div>
        <div className={styles.toolbarActions}>
          <button type="button" className={styles.actionBtn} onClick={exportExcel}>
            Export Excel
          </button>
          <button type="button" className={styles.actionBtn} onClick={printBudget}>
            Print
          </button>
        </div>
      </div>

      <div className={styles.legend} aria-label="Cost certainty legend">
        <span className={`${styles.legendItem} ${styles.legendItemEstimated}`}>
          <span className={`${styles.legendSwatch} ${styles.legendEstimated}`} aria-hidden />
          Estimated cost
        </span>
        <span className={styles.legendItem}>
          <span className={`${styles.legendSwatch} ${styles.legendConfirmed}`} aria-hidden />
          Confirmed cost
        </span>
      </div>

      {viewMode === 'category' ? (
        <>
          <header className={styles.categoryHeader}>
            <span className={`th-cat-${categorySlug} th-cat-icon`}>
              <CategoryIcon category={category} size={20} />
            </span>
            <h2 className={styles.sectionTitle}>{category}</h2>
          </header>
          <BudgetLineTable lines={categoryLines} homeCurrency={config.homeCurrency} onEditEntry={openEntryForEdit} />
        </>
      ) : (
        <div className={styles.allCategories}>
          {BUDGET_CATEGORY_ORDER.map((cat) => {
            const lines = buildBudgetDetailLines(entries, cat, convertToHomeCurrency, dayLabelFor, tripDays);
            if (!lines.length) return null;
            const slug = getCategorySlug(cat);
            return (
              <section key={cat} className={styles.categoryBlock}>
                <header className={styles.categoryHeader}>
                  <span className={`th-cat-${slug} th-cat-icon`}>
                    <CategoryIcon category={cat} size={20} />
                  </span>
                  <h2 className={styles.sectionTitle}>{cat}</h2>
                </header>
                <BudgetLineTable lines={lines} homeCurrency={config.homeCurrency} onEditEntry={openEntryForEdit} />
              </section>
            );
          })}
        </div>
      )}
      {printHtml ? (
        <BudgetPrintSheet
          title={`${trip?.title ?? 'Trip'} — Budget`}
          html={printHtml}
          onClose={() => setPrintHtml(null)}
        />
      ) : null}
    </section>
  );
};
