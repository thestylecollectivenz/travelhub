import * as React from 'react';
import { CategoryIcon } from '../shared/CategoryIcon';
import { MOCK_ITINERARY_ENTRIES } from '../../mocks/tripMock';
import {
  BUDGET_CATEGORY_ORDER,
  formatNZD,
  getPaymentSummaryForDayCategory,
  sumForDay,
  sumForDayByCategory
} from '../../utils/financialUtils';
import styles from './BudgetBreakdownTile.module.css';

export interface BudgetBreakdownTileProps {
  tripId: string;
  dayId: string;
}

export const BudgetBreakdownTile: React.FC<BudgetBreakdownTileProps> = ({ tripId, dayId }) => {
  const entries = React.useMemo(
    () => MOCK_ITINERARY_ENTRIES.filter((e) => e.tripId === tripId),
    [tripId]
  );

  const dayEntries = React.useMemo(() => entries.filter((e) => e.dayId === dayId), [entries, dayId]);

  const sumsByCategory = React.useMemo(() => sumForDayByCategory(entries, dayId), [entries, dayId]);

  const categoriesToShow = React.useMemo(() => {
    return BUDGET_CATEGORY_ORDER.filter((key) => {
      const s = getPaymentSummaryForDayCategory(entries, dayId, key);
      return s.itemCount > 0;
    });
  }, [entries, dayId]);

  const dayTotalAll = sumForDay(entries, dayId);

  if (dayEntries.length === 0) {
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
        <span className={styles.tileTotal}>{formatNZD(dayTotalAll)}</span>
      </div>
      {categoriesToShow.map((category) => {
        const summary = getPaymentSummaryForDayCategory(entries, dayId, category);
        const pct =
          summary.total > 0 ? Math.min(100, Math.max(0, (summary.paid / summary.total) * 100)) : 0;
        const countLabel = summary.itemCount === 1 ? '1 item' : `${summary.itemCount} items`;
        const lineTotal = sumsByCategory[category] ?? summary.total;
        return (
          <div key={category} className={styles.row}>
            <div className={styles.rowLeft}>
              <CategoryIcon category={category} size={14} />
              <span className={styles.name}>{category}</span>
              <span className={styles.count}>{countLabel}</span>
            </div>
            <div className={styles.spacer} />
            <div className={styles.progressWrap} aria-hidden>
              <div className={styles.progressFill} style={{ width: `${pct}%` }} />
            </div>
            <span className={styles.amount}>{formatNZD(lineTotal)}</span>
          </div>
        );
      })}
    </section>
  );
};
