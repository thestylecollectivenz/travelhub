import * as React from 'react';
import { useTripWorkspace } from '../../context/TripWorkspaceContext';
import { useConfig } from '../../context/ConfigContext';
import { getCategorySlug } from '../../utils/categoryUtils';
import { CategoryIcon } from '../shared/CategoryIcon';
import {
  BUDGET_CATEGORY_ORDER,
  formatCurrency,
  getPaymentSummaryForDayCategory,
  sumForDay,
  sumForDayByCategory
} from '../../utils/financialUtils';
import { isPreTripDayRow } from '../../utils/itineraryDayEntries';
import styles from './BudgetBreakdownTile.module.css';

export interface BudgetBreakdownTileProps {
  tripId: string;
  dayId: string;
  onHide?: () => void;
}

export const BudgetBreakdownTile: React.FC<BudgetBreakdownTileProps> = ({ tripId, dayId, onHide }) => {
  const { localEntries, convertToHomeCurrency, tripDays, trip } = useTripWorkspace();
  const { config } = useConfig();

  const entries = React.useMemo(
    () => localEntries.filter((e) => e.tripId === tripId),
    [localEntries, tripId]
  );

  const dayCalendarDate = React.useMemo(() => {
    if (!trip) return '';
    return tripDays.find((d) => d.tripId === trip.id && d.id === dayId)?.calendarDate ?? '';
  }, [trip, tripDays, dayId]);

  const homeDayEntriesOnly = React.useMemo(() => {
    if (!trip) return false;
    const d = tripDays.find((x) => x.tripId === trip.id && x.id === dayId);
    return d ? isPreTripDayRow(d) : false;
  }, [trip, tripDays, dayId]);

  const sumsByCategory = React.useMemo(
    () => sumForDayByCategory(entries, dayId, convertToHomeCurrency, dayCalendarDate, homeDayEntriesOnly),
    [entries, dayId, convertToHomeCurrency, dayCalendarDate, homeDayEntriesOnly]
  );

  const categoriesToShow = React.useMemo(() => {
    return BUDGET_CATEGORY_ORDER.filter((key) => {
      const s = getPaymentSummaryForDayCategory(
        entries,
        dayId,
        key,
        convertToHomeCurrency,
        dayCalendarDate,
        homeDayEntriesOnly
      );
      return s.itemCount > 0;
    });
  }, [entries, dayId, convertToHomeCurrency, dayCalendarDate, homeDayEntriesOnly]);

  const dayTotalAll = sumForDay(entries, dayId, convertToHomeCurrency, dayCalendarDate, homeDayEntriesOnly);

  if (categoriesToShow.length === 0) {
    return (
      <section className={styles.tile} aria-label="Day budget breakdown">
        <div className={styles.empty}>No items for this day yet</div>
      </section>
    );
  }

  return (
    <section className={styles.tile} aria-label="Day budget breakdown">
      <div className={styles.tileHeader}>
        <h2 className={styles.tileTitle}>Day Breakdown</h2>
        <span className={styles.tileTotal}>{formatCurrency(dayTotalAll, config.homeCurrency)}</span>
        {onHide ? (
          <button type="button" className={styles.hideBtn} onClick={onHide}>
            Hide
          </button>
        ) : null}
      </div>
      {categoriesToShow.map((category) => {
        const summary = getPaymentSummaryForDayCategory(
          entries,
          dayId,
          category,
          convertToHomeCurrency,
          dayCalendarDate,
          homeDayEntriesOnly
        );
        const pct =
          summary.total > 0 ? Math.min(100, Math.max(0, (summary.paid / summary.total) * 100)) : 0;
        const countLabel = summary.itemCount === 1 ? '1 item' : `${summary.itemCount} items`;
        const lineTotal = sumsByCategory[category] ?? summary.total;
        const categorySlug = getCategorySlug(category);
        return (
          <div key={category} className={styles.row}>
            <div className={styles.rowLeft}>
              <span className={lineTotal > 0 ? `th-cat-${categorySlug} th-cat-icon` : undefined}>
                <CategoryIcon category={category} size={14} color={lineTotal > 0 ? 'currentColor' : 'var(--color-sand-400)'} />
              </span>
              <span className={styles.name}>{category}</span>
              <span className={styles.count}>{countLabel}</span>
            </div>
            <div className={styles.spacer} />
            <div className={styles.progressWrap} aria-hidden>
              <div className={styles.progressFill} style={{ width: `${pct}%` }} />
            </div>
            <span className={styles.amount}>{formatCurrency(lineTotal, config.homeCurrency)}</span>
          </div>
        );
      })}
    </section>
  );
};
