import * as React from 'react';
import { CategoryIcon } from '../shared/CategoryIcon';
import { useTripWorkspace } from '../../context/TripWorkspaceContext';
import { useConfig } from '../../context/ConfigContext';
import { usePlaces } from '../../context/PlacesContext';
import { useTripPermissions } from '../../hooks/useTripPermissions';
import { useShellMode } from '../../hooks/useShellMode';
import type { ItineraryEntry, ItinerarySubItem } from '../../models/ItineraryEntry';
import { getCategorySlug } from '../../utils/categoryUtils';
import { placeDisplayLabel } from '../../utils/placeDisplayLabel';
import {
  avgPerDay,
  BUDGET_CATEGORY_ORDER,
  formatCurrency,
  sumByPaymentStatus,
  type BudgetCategoryKey
} from '../../utils/financialUtils';
import { isPreTripDayRow } from '../../utils/itineraryDayEntries';
import { formatYmdDisplay } from '../../utils/localDate';
import {
  buildBudgetDetailLines,
  sumBudgetLines,
  type BudgetDetailLine
} from '../../utils/budgetDetailLines';
import { buildBudgetPrintHtml, exportFullBudgetToExcel } from '../../utils/exportBudgetExcel';
import { BudgetPrintSheet } from '../budget/BudgetPrintSheet';
import { MobileFilterDisclosure } from './MobileFilterDisclosure';
import chrome from './MobileTabChrome.module.css';
import styles from './MobileBudgetView.module.css';

type BudgetViewMode = 'category' | 'all';
type BudgetLineSort = 'date' | 'alpha';
type CertaintyFilter = 'estimated' | 'confirmed' | 'unpaid' | 'needs_booking' | null;

export interface MobileBudgetViewProps {
  /** Switch back to the day plan after opening an item for edit. */
  onOpenPlan?: () => void;
}

function avgUnitLabel(spanLabel?: string): 'night' | 'day' {
  return spanLabel && spanLabel.indexOf('night') >= 0 ? 'night' : 'day';
}

function filterLines(
  lines: BudgetDetailLine[],
  entries: ItineraryEntry[],
  certaintyFilter: CertaintyFilter,
  lineSort: BudgetLineSort,
  supplierFilter: string | null
): BudgetDetailLine[] {
  let out = lines;
  if (supplierFilter) out = out.filter((line) => line.supplier === supplierFilter);
  if (certaintyFilter === 'estimated') out = out.filter((line) => line.costCertainty === 'Estimated');
  if (certaintyFilter === 'confirmed') out = out.filter((line) => line.costCertainty === 'Confirmed');
  if (certaintyFilter === 'unpaid' || certaintyFilter === 'needs_booking') {
    out = out.filter((line) => {
      const entry = entries.find((e) => e.id === line.entryId);
      if (!entry) return false;
      if (certaintyFilter === 'unpaid') {
        return (
          (entry.paymentStatus !== 'Fully paid' && entry.paymentStatus !== 'Free' && (entry.amount ?? 0) > 0) ||
          entry.paymentStatus === 'Part paid'
        );
      }
      return entry.bookingRequired && entry.bookingStatus !== 'Booked';
    });
  }
  const sorted = [...out];
  if (lineSort === 'alpha') {
    sorted.sort((a, b) => a.title.localeCompare(b.title) || a.sortKey.localeCompare(b.sortKey));
  } else {
    sorted.sort((a, b) => a.sortKey.localeCompare(b.sortKey) || a.title.localeCompare(b.title));
  }
  return sorted;
}

export const MobileBudgetView: React.FC<MobileBudgetViewProps> = ({ onOpenPlan }) => {
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
    setFocusedEntryId
  } = useTripWorkspace();
  const { config } = useConfig();
  const { placeById } = usePlaces();
  const { canEditItinerary, canUseExports } = useTripPermissions();
  const shellMode = useShellMode();
  const [viewMode, setViewMode] = React.useState<BudgetViewMode>(
    selectedBudgetCategory ? 'category' : 'category'
  );
  const [filtersOpen, setFiltersOpen] = React.useState(false);
  const [lineSort, setLineSort] = React.useState<BudgetLineSort>('date');
  const [certaintyFilter, setCertaintyFilter] = React.useState<CertaintyFilter>(null);
  const [supplierFilter, setSupplierFilter] = React.useState<string | null>(null);
  const [printHtml, setPrintHtml] = React.useState<string | null>(null);
  /** Categories expanded in All categories view — start empty (all collapsed). */
  const [expandedCats, setExpandedCats] = React.useState<ReadonlySet<string>>(() => new Set());
  const isIpad = shellMode === 'ipad-portrait';

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
  const home = config.homeCurrency;

  const dayLabelFor = React.useCallback(
    (dayId: string): string => {
      const d = tripDays.find((x) => x.id === dayId);
      if (!d) return 'Day';
      if (d.dayType === 'PreTrip') return 'Pre-trip';
      return formatYmdDisplay(d.calendarDate) || `Day ${d.dayNumber}`;
    },
    [tripDays]
  );

  const category: BudgetCategoryKey = selectedBudgetCategory ?? BUDGET_CATEGORY_ORDER[0];

  const openEntryForEdit = React.useCallback(
    (entryId: string, subItemId?: string): void => {
      if (!canEditItinerary) return;
      const entry = localEntries.find((e) => e.id === entryId);
      if (!entry) return;
      onOpenPlan?.();
      setSelectedDayId(entry.dayId);
      setFocusedEntryId(null);
      if (subItemId) {
        setEditingSubItem({ parentEntryId: entryId, subItemId });
        setEditingCardId(null);
      } else {
        setEditingSubItem(null);
        setEditingCardId(entryId);
      }
    },
    [
      canEditItinerary,
      localEntries,
      onOpenPlan,
      setSelectedDayId,
      setFocusedEntryId,
      setEditingCardId,
      setEditingSubItem
    ]
  );

  const printBudget = React.useCallback((): void => {
    if (!trip || !canUseExports) return;
    const html = buildBudgetPrintHtml({
      tripTitle: trip.title,
      homeCurrency: home,
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
    canUseExports,
    home,
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
    if (!trip || !canUseExports) return;
    exportFullBudgetToExcel({
      trip,
      entries,
      tripDays,
      homeCurrency: home,
      convertToHomeCurrency,
      dayLabelFor,
      locationFor
    });
  }, [trip, canUseExports, entries, tripDays, home, convertToHomeCurrency, dayLabelFor, locationFor]);

  const renderLineList = (lines: BudgetDetailLine[], catLabel?: string): React.ReactNode => {
    const visible = filterLines(lines, entries, certaintyFilter, lineSort, supplierFilter);
    if (!lines.length) {
      return <p className={styles.empty}>No line items with amounts{catLabel ? ` in ${catLabel}` : ''} yet.</p>;
    }
    if (!visible.length) {
      return <p className={styles.empty}>No lines match the current filters.</p>;
    }
    const totals = sumBudgetLines(visible);
    return (
      <div className={`${styles.lineList} ${isIpad ? styles.lineListCols : ''}`.trim()}>
        {isIpad ? (
          <div className={`${styles.lineRow} ${styles.lineHeader}`} aria-hidden>
            <span>Details</span>
            <span className={styles.colMoney}>Total</span>
            <span className={styles.colMoney}>Spent</span>
            <span className={styles.colMoney}>Remaining</span>
          </div>
        ) : null}
        {isIpad ? (
          <div className={`${styles.lineRow} ${styles.lineTotals}`}>
            <span className={styles.totalsLabel}>Totals ({visible.length})</span>
            <span className={`${styles.lineAmount} ${styles.colMoney}`}>{formatCurrency(totals.total, home)}</span>
            <span className={`${styles.lineAmount} ${styles.colMoney}`}>{formatCurrency(totals.spent, home)}</span>
            <span className={`${styles.lineAmount} ${styles.colMoney}`}>{formatCurrency(totals.remaining, home)}</span>
          </div>
        ) : null}
        {visible.map((line) => {
          const estimated = line.costCertainty === 'Estimated';
          const clickable = canEditItinerary;
          const title = line.isSubItem ? `${line.title} (${line.parentTitle || 'Card'})` : line.title;
          const details = (
            <div className={styles.lineMain}>
              <span className={styles.lineTitle}>{title}</span>
              {line.supplier ? <span className={styles.lineMeta}>{line.supplier}</span> : null}
              {line.locationLine ? <span className={styles.lineMeta}>{line.locationLine}</span> : null}
              {line.dateLines.map((d) => (
                <span key={d} className={styles.lineMeta}>
                  {d}
                </span>
              ))}
              {line.spanLabel ? <span className={styles.lineMeta}>{line.spanLabel}</span> : null}
              {line.avgPerDay !== undefined && line.avgPerDay > 0 ? (
                <span className={styles.lineMeta}>
                  Avg {formatCurrency(line.avgPerDay, home)} / {avgUnitLabel(line.spanLabel)}
                </span>
              ) : null}
            </div>
          );
          const money = isIpad ? (
            <>
              <span className={`${styles.lineAmount} ${styles.colMoney}`}>{formatCurrency(line.total, home)}</span>
              <span className={`${styles.lineAmount} ${styles.colMoney}`}>{formatCurrency(line.spent, home)}</span>
              <span className={`${styles.lineAmount} ${styles.colMoney}`}>{formatCurrency(line.remaining, home)}</span>
            </>
          ) : (
            <div className={styles.lineMoney}>
              <span className={styles.lineTotal}>{formatCurrency(line.total, home)}</span>
              <span className={styles.lineSplit}>
                Spent {formatCurrency(line.spent, home)} · Left {formatCurrency(line.remaining, home)}
              </span>
            </div>
          );
          const rowClass = `${styles.lineRow} ${estimated ? styles.lineEstimated : ''}`.trim();
          return clickable ? (
            <button
              key={line.id}
              type="button"
              className={rowClass}
              onClick={() => openEntryForEdit(line.entryId, line.subItemId)}
            >
              {details}
              {money}
            </button>
          ) : (
            <div key={line.id} className={rowClass}>
              {details}
              {money}
            </div>
          );
        })}
        {!isIpad ? (
          <div className={`${styles.lineRow} ${styles.lineTotals}`}>
            <span className={styles.totalsLabel}>Totals ({visible.length})</span>
            <div className={styles.lineMoney}>
              <span className={styles.lineTotal}>{formatCurrency(totals.total, home)}</span>
              <span className={styles.lineSplit}>
                Spent {formatCurrency(totals.spent, home)} · Left {formatCurrency(totals.remaining, home)}
              </span>
            </div>
          </div>
        ) : null}
      </div>
    );
  };

  const categoryLines = React.useMemo(
    () => buildBudgetDetailLines(entries, category, convertToHomeCurrency, dayLabelFor, tripDays, locationFor),
    [entries, category, convertToHomeCurrency, dayLabelFor, tripDays, locationFor]
  );

  const allCategoryBlocks = React.useMemo(() => {
    return BUDGET_CATEGORY_ORDER.map((cat) => {
      const lines = buildBudgetDetailLines(
        entries,
        cat,
        convertToHomeCurrency,
        dayLabelFor,
        tripDays,
        locationFor
      );
      if (!lines.length) return null;
      const visible = filterLines(lines, entries, certaintyFilter, lineSort, supplierFilter);
      const totals = sumBudgetLines(visible.length ? visible : lines);
      return { cat, lines, visible, totals };
    }).filter(Boolean) as Array<{
      cat: BudgetCategoryKey;
      lines: BudgetDetailLine[];
      visible: BudgetDetailLine[];
      totals: ReturnType<typeof sumBudgetLines>;
    }>;
  }, [
    entries,
    convertToHomeCurrency,
    dayLabelFor,
    tripDays,
    locationFor,
    certaintyFilter,
    lineSort,
    supplierFilter
  ]);

  const allCatKeys = React.useMemo(() => allCategoryBlocks.map((b) => b.cat), [allCategoryBlocks]);

  const expandAllCats = React.useCallback((): void => {
    setExpandedCats(new Set(allCatKeys));
  }, [allCatKeys]);

  const collapseAllCats = React.useCallback((): void => {
    setExpandedCats(new Set());
  }, []);

  const toggleCat = React.useCallback((cat: string): void => {
    setExpandedCats((prev) => {
      const next = new Set(prev);
      if (next.has(cat)) next.delete(cat);
      else next.add(cat);
      return next;
    });
  }, []);

  const switchToAll = React.useCallback((): void => {
    setViewMode('all');
    setSelectedBudgetCategory(null);
    setExpandedCats(new Set());
  }, [setSelectedBudgetCategory]);

  const suppliers = React.useMemo(() => {
    const source =
      viewMode === 'category'
        ? categoryLines
        : allCategoryBlocks.flatMap((b) => b.lines);
    const set = new Set<string>();
    for (const line of source) {
      if (line.supplier) set.add(line.supplier);
    }
    return Array.from(set).sort();
  }, [viewMode, categoryLines, allCategoryBlocks]);

  React.useEffect(() => {
    setSupplierFilter(null);
  }, [selectedBudgetCategory, viewMode, certaintyFilter]);

  if (!trip) {
    return <p className={chrome.muted}>Open a trip to see the budget.</p>;
  }

  return (
    <div
      className={styles.page}
      data-shell={shellMode === 'ipad-portrait' ? 'ipad-portrait' : undefined}
      aria-label="Trip budget"
    >
      <p className={styles.intro}>
        {tripDayCount} trip day{tripDayCount === 1 ? '' : 's'} · All figures in {home}
        {!canEditItinerary ? ' · View only' : ''}
      </p>

      <div className={styles.summaryStrip} role="group" aria-label="Budget totals">
        <div className={styles.summaryChip}>
          <span className={styles.chipValue}>{formatCurrency(totalBudget, home)}</span>
          <span className={styles.chipLabel}>Total</span>
        </div>
        <div className={styles.summaryChip}>
          <span className={styles.chipValue}>{formatCurrency(spentSoFar, home)}</span>
          <span className={styles.chipLabel}>Spent</span>
        </div>
        <div className={styles.summaryChip}>
          <span className={styles.chipValue}>{formatCurrency(remaining, home)}</span>
          <span className={styles.chipLabel}>Remaining</span>
        </div>
        <div className={styles.summaryChip}>
          <span className={styles.chipValue}>{formatCurrency(averagePerDay, home)}</span>
          <span className={styles.chipLabel}>Avg / day</span>
        </div>
      </div>

      <MobileFilterDisclosure
        open={filtersOpen}
        onToggle={() => setFiltersOpen((v) => !v)}
        trailing={
          viewMode === 'all' ? (
            <>
              <button type="button" className={chrome.filterToggle} onClick={expandAllCats}>
                Expand all
              </button>
              <button type="button" className={chrome.filterToggle} onClick={collapseAllCats}>
                Collapse all
              </button>
            </>
          ) : undefined
        }
      >
        <div className={chrome.filterPanel}>
          <div>
            <p className={chrome.filterGroupTitle}>View</p>
            <div className={chrome.chipRow}>
              <button
                type="button"
                className={`${chrome.chip} ${viewMode === 'category' ? chrome.chipActive : ''}`}
                onClick={() => setViewMode('category')}
              >
                By category
              </button>
              <button
                type="button"
                className={`${chrome.chip} ${viewMode === 'all' ? chrome.chipActive : ''}`}
                onClick={switchToAll}
              >
                All categories
              </button>
            </div>
          </div>

          {viewMode === 'category' ? (
            <div>
              <p className={chrome.filterGroupTitle}>Category</p>
              <div className={chrome.chipRow}>
                {BUDGET_CATEGORY_ORDER.map((cat) => (
                  <button
                    key={cat}
                    type="button"
                    className={`${chrome.chip} ${category === cat ? chrome.chipActive : ''}`}
                    onClick={() => setSelectedBudgetCategory(cat)}
                  >
                    {cat}
                  </button>
                ))}
              </div>
            </div>
          ) : null}

          <div>
            <p className={chrome.filterGroupTitle}>Status</p>
            <div className={chrome.chipRow}>
              {(
                [
                  { key: null, label: 'All' },
                  { key: 'estimated' as const, label: 'Estimated' },
                  { key: 'confirmed' as const, label: 'Confirmed' },
                  { key: 'unpaid' as const, label: 'Unpaid' },
                  { key: 'needs_booking' as const, label: 'Needs booking' }
                ] as Array<{ key: CertaintyFilter; label: string }>
              ).map((opt) => (
                <button
                  key={opt.label}
                  type="button"
                  className={`${chrome.chip} ${certaintyFilter === opt.key ? chrome.chipActive : ''}`}
                  onClick={() => setCertaintyFilter(opt.key)}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          </div>

          <div>
            <p className={chrome.filterGroupTitle}>Sort</p>
            <div className={chrome.chipRow}>
              <button
                type="button"
                className={`${chrome.chip} ${lineSort === 'date' ? chrome.chipActive : ''}`}
                onClick={() => setLineSort('date')}
              >
                By date
              </button>
              <button
                type="button"
                className={`${chrome.chip} ${lineSort === 'alpha' ? chrome.chipActive : ''}`}
                onClick={() => setLineSort('alpha')}
              >
                A–Z
              </button>
            </div>
          </div>

          {suppliers.length > 1 ? (
            <div>
              <p className={chrome.filterGroupTitle}>Supplier</p>
              <div className={chrome.chipRow}>
                <button
                  type="button"
                  className={`${chrome.chip} ${supplierFilter === null ? chrome.chipActive : ''}`}
                  onClick={() => setSupplierFilter(null)}
                >
                  All suppliers
                </button>
                {suppliers.map((supplier) => (
                  <button
                    key={supplier}
                    type="button"
                    className={`${chrome.chip} ${supplierFilter === supplier ? chrome.chipActive : ''}`}
                    onClick={() => setSupplierFilter(supplier)}
                  >
                    {supplier}
                  </button>
                ))}
              </div>
            </div>
          ) : null}

          {canUseExports ? (
            <div className={styles.exportRow}>
              <button type="button" className={chrome.chip} onClick={exportExcel}>
                Export Excel
              </button>
              <button type="button" className={chrome.chip} onClick={printBudget}>
                Print
              </button>
            </div>
          ) : null}
        </div>
      </MobileFilterDisclosure>

      <div className={styles.legend} aria-label="Cost certainty legend">
        <span className={styles.legendItem}>
          <span className={`${styles.legendSwatch} ${styles.legendEstimated}`} aria-hidden />
          Estimated
        </span>
        <span className={styles.legendItem}>
          <span className={`${styles.legendSwatch} ${styles.legendConfirmed}`} aria-hidden />
          Confirmed
        </span>
      </div>

      {viewMode === 'category' ? (
        <section className={styles.section}>
          <header className={styles.sectionHead}>
            <span className={`th-cat-${getCategorySlug(category)} th-cat-icon`}>
              <CategoryIcon category={category} size={18} />
            </span>
            <h3 className={styles.sectionTitle}>{category}</h3>
          </header>
          {renderLineList(categoryLines, category)}
        </section>
      ) : (
        <div className={styles.allCategories}>
          {allCategoryBlocks.map(({ cat, lines, totals }) => {
            const open = expandedCats.has(cat);
            return (
              <section key={cat} className={styles.section}>
                <button
                  type="button"
                  className={styles.catToggle}
                  aria-expanded={open}
                  onClick={() => toggleCat(cat)}
                >
                  <span className={styles.catToggleLeft}>
                    <span className={styles.catChevron} aria-hidden>
                      {open ? '▾' : '▸'}
                    </span>
                    <span className={`th-cat-${getCategorySlug(cat)} th-cat-icon`}>
                      <CategoryIcon category={cat} size={18} />
                    </span>
                    <span className={styles.sectionTitle}>{cat}</span>
                  </span>
                  <span className={styles.catHeadline} aria-label={`${cat} totals`}>
                    <span className={styles.catHeadlineItem}>
                      <span className={styles.catHeadlineLabel}>Total</span>
                      <span className={styles.catHeadlineValue}>{formatCurrency(totals.total, home)}</span>
                    </span>
                    <span className={styles.catHeadlineItem}>
                      <span className={styles.catHeadlineLabel}>Spent</span>
                      <span className={styles.catHeadlineValue}>{formatCurrency(totals.spent, home)}</span>
                    </span>
                    <span className={styles.catHeadlineItem}>
                      <span className={styles.catHeadlineLabel}>Left</span>
                      <span className={styles.catHeadlineValue}>{formatCurrency(totals.remaining, home)}</span>
                    </span>
                  </span>
                </button>
                {open ? renderLineList(lines, cat) : null}
              </section>
            );
          })}
        </div>
      )}

      {printHtml ? (
        <BudgetPrintSheet
          title={`${trip.title} — Budget`}
          html={printHtml}
          onClose={() => setPrintHtml(null)}
        />
      ) : null}
    </div>
  );
};
