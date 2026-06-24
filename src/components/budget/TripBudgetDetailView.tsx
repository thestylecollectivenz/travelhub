import * as React from 'react';
import { CategoryIcon } from '../shared/CategoryIcon';
import { useTripWorkspace } from '../../context/TripWorkspaceContext';
import { useConfig } from '../../context/ConfigContext';
import { usePlaces } from '../../context/PlacesContext';
import type { ItineraryEntry, ItinerarySubItem } from '../../models/ItineraryEntry';
import { getCategorySlug } from '../../utils/categoryUtils';
import { placeDisplayLabel } from '../../utils/placeDisplayLabel';
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
type BudgetLineSort = 'date' | 'alpha';

function avgUnitLabel(spanLabel?: string): 'night' | 'day' {
  return spanLabel && spanLabel.indexOf('night') >= 0 ? 'night' : 'day';
}

function BudgetLineTable({
  lines,
  homeCurrency,
  category,
  supplierFilter,
  onSupplierFilter,
  transportSubtypeFilter,
  onTransportSubtypeFilter,
  onEditEntry,
  lineSort,
  onLineSort
}: {
  lines: BudgetDetailLine[];
  homeCurrency: string;
  category?: string;
  supplierFilter: string | null;
  onSupplierFilter: (value: string | null) => void;
  transportSubtypeFilter: string | null;
  onTransportSubtypeFilter: (value: string | null) => void;
  onEditEntry: (entryId: string, subItemId?: string) => void;
  lineSort: BudgetLineSort;
  onLineSort: (value: BudgetLineSort) => void;
}): React.ReactElement {
  const suppliers = React.useMemo(() => {
    const set = new Set<string>();
    for (const line of lines) {
      if (line.supplier) set.add(line.supplier);
    }
    return Array.from(set).sort();
  }, [lines]);

  const transportSubtypes = React.useMemo(() => {
    const set = new Set<string>();
    for (const line of lines) {
      if (line.transportSubtype) set.add(line.transportSubtype);
    }
    return Array.from(set).sort();
  }, [lines]);

  const visibleLines = React.useMemo(() => {
    let out = lines;
    if (supplierFilter) out = out.filter((line) => line.supplier === supplierFilter);
    if (transportSubtypeFilter) out = out.filter((line) => line.transportSubtype === transportSubtypeFilter);
    const sorted = [...out];
    if (lineSort === 'alpha') {
      sorted.sort((a, b) => a.title.localeCompare(b.title) || a.sortKey.localeCompare(b.sortKey));
    } else {
      sorted.sort((a, b) => a.sortKey.localeCompare(b.sortKey) || a.title.localeCompare(b.title));
    }
    return sorted;
  }, [lines, supplierFilter, transportSubtypeFilter, lineSort]);

  const totals = sumBudgetLines(visibleLines);
  if (!lines.length) {
    return <p className={styles.emptyHint}>No line items with amounts in this category yet.</p>;
  }
  return (
    <div className={styles.lineList}>
      {suppliers.length > 1 ? (
        <div className={styles.subtypeFilters} role="group" aria-label="Supplier filter">
          <button
            type="button"
            className={`${styles.subtypeChip} ${supplierFilter === null ? styles.subtypeChipActive : ''}`}
            onClick={() => onSupplierFilter(null)}
          >
            All suppliers
          </button>
          {suppliers.map((supplier) => (
            <button
              key={supplier}
              type="button"
              className={`${styles.subtypeChip} ${supplierFilter === supplier ? styles.subtypeChipActive : ''}`}
              onClick={() => onSupplierFilter(supplier)}
            >
              {supplier}
            </button>
          ))}
        </div>
      ) : null}
      {category === 'Transport' && transportSubtypes.length > 1 ? (
        <div className={styles.subtypeFilters} role="group" aria-label="Transport mode filter">
          <button
            type="button"
            className={`${styles.subtypeChip} ${transportSubtypeFilter === null ? styles.subtypeChipActive : ''}`}
            onClick={() => onTransportSubtypeFilter(null)}
          >
            All modes
          </button>
          {transportSubtypes.map((mode) => (
            <button
              key={mode}
              type="button"
              className={`${styles.subtypeChip} ${transportSubtypeFilter === mode ? styles.subtypeChipActive : ''}`}
              onClick={() => onTransportSubtypeFilter(mode)}
            >
              {mode}
            </button>
          ))}
        </div>
      ) : null}
      <div className={styles.sortRow} role="group" aria-label="Sort line items">
        <span className={styles.sortLabel}>Sort</span>
        <button
          type="button"
          className={`${styles.subtypeChip} ${lineSort === 'date' ? styles.subtypeChipActive : ''}`}
          onClick={() => onLineSort('date')}
        >
          Date &amp; time
        </button>
        <button
          type="button"
          className={`${styles.subtypeChip} ${lineSort === 'alpha' ? styles.subtypeChipActive : ''}`}
          onClick={() => onLineSort('alpha')}
        >
          A–Z
        </button>
      </div>
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
      {visibleLines.map((line) => (
        <div
          key={line.id}
          className={`${styles.lineRow} ${line.costCertainty === 'Estimated' ? styles.lineEstimated : styles.lineConfirmed}`}
        >
          <div className={styles.lineMain}>
            <span className={styles.lineTitle}>
              {line.isSubItem ? `${line.title} (${line.parentTitle || 'Card'})` : line.title}
              <button
                type="button"
                className={styles.editLink}
                onClick={() => onEditEntry(line.entryId, line.subItemId)}
              >
                Edit
              </button>
            </span>
            {line.locationLine ? <span className={styles.lineMeta}>{line.locationLine}</span> : null}
            {line.supplier ? <span className={styles.lineMeta}>{line.supplier}</span> : null}
            {line.dateLines.map((d) => (
              <span key={d} className={styles.lineMeta}>
                {d}
              </span>
            ))}
            {line.spanLabel ? <span className={styles.lineMeta}>{line.spanLabel}</span> : null}
            {line.avgPerDay !== undefined && line.avgPerDay > 0 ? (
              <span className={styles.lineMeta}>
                Avg {formatCurrency(line.avgPerDay, homeCurrency)} / {avgUnitLabel(line.spanLabel)}
              </span>
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
    setEditingSubItem,
    setFocusedEntryId,
    setMainWorkspaceTab
  } = useTripWorkspace();
  const { config } = useConfig();
  const { placeById } = usePlaces();
  const [viewMode, setViewMode] = React.useState<BudgetViewMode>('category');
  const [printHtml, setPrintHtml] = React.useState<string | null>(null);
  const [transportSubtypeFilter, setTransportSubtypeFilter] = React.useState<string | null>(null);
  const [supplierFilter, setSupplierFilter] = React.useState<string | null>(null);
  const [lineSort, setLineSort] = React.useState<BudgetLineSort>('date');

  React.useEffect(() => {
    if (selectedBudgetCategory) {
      setViewMode('category');
    }
    setTransportSubtypeFilter(null);
    setSupplierFilter(null);
  }, [selectedBudgetCategory]);

  const locationFor = React.useCallback(
    (entry: ItineraryEntry, sub?: ItinerarySubItem): string => {
      const direct = (sub?.location || entry.location || '').trim();
      if (direct) return direct;
      const day = tripDays.find((d) => d.id === entry.dayId);
      if (day?.primaryPlaceId) {
        const place = placeById(day.primaryPlaceId);
        if (place) return placeDisplayLabel(place);
      }
      return '';
    },
    [tripDays, placeById]
  );

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
    (entryId: string, subItemId?: string): void => {
      const entry = localEntries.find((e) => e.id === entryId);
      if (!entry) return;
      setMainWorkspaceTab('itinerary');
      setSelectedDayId(entry.dayId);
      setFocusedEntryId(null);
      setEditingCardId(null);
      if (subItemId) {
        setEditingSubItem({ parentEntryId: entryId, subItemId });
      } else {
        setEditingSubItem(null);
        setEditingCardId(entryId);
      }
    },
    [localEntries, setEditingCardId, setEditingSubItem, setFocusedEntryId, setMainWorkspaceTab, setSelectedDayId]
  );

  const category = selectedBudgetCategory ?? BUDGET_CATEGORY_ORDER[0];
  const categoryLines = React.useMemo(
    () => buildBudgetDetailLines(entries, category, convertToHomeCurrency, dayLabelFor, tripDays, locationFor),
    [entries, category, convertToHomeCurrency, dayLabelFor, tripDays, locationFor]
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
      dayLabelFor,
      locationFor
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
    dayLabelFor,
    locationFor
  ]);

  const exportExcel = React.useCallback((): void => {
    if (!trip) return;
    exportFullBudgetToExcel({
      trip,
      entries,
      tripDays,
      homeCurrency: config.homeCurrency,
      convertToHomeCurrency,
      dayLabelFor,
      locationFor
    });
  }, [trip, entries, tripDays, config.homeCurrency, convertToHomeCurrency, dayLabelFor, locationFor]);

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
          <BudgetLineTable
            lines={categoryLines}
            homeCurrency={config.homeCurrency}
            category={category}
            supplierFilter={supplierFilter}
            onSupplierFilter={setSupplierFilter}
            transportSubtypeFilter={transportSubtypeFilter}
            onTransportSubtypeFilter={setTransportSubtypeFilter}
            onEditEntry={openEntryForEdit}
            lineSort={lineSort}
            onLineSort={setLineSort}
          />
        </>
      ) : (
        <div className={styles.allCategories}>
          {BUDGET_CATEGORY_ORDER.map((cat) => {
            const lines = buildBudgetDetailLines(entries, cat, convertToHomeCurrency, dayLabelFor, tripDays, locationFor);
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
                <BudgetLineTable
                  lines={lines}
                  homeCurrency={config.homeCurrency}
                  category={cat}
                  supplierFilter={null}
                  onSupplierFilter={() => undefined}
                  transportSubtypeFilter={null}
                  onTransportSubtypeFilter={() => undefined}
                  onEditEntry={openEntryForEdit}
                  lineSort={lineSort}
                  onLineSort={setLineSort}
                />
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
