import * as React from 'react';
import { useTripWorkspace } from '../../context/TripWorkspaceContext';
import { getCategorySlug } from '../../utils/categoryUtils';
import { CategoryIcon } from '../shared/CategoryIcon';
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
  const { localEntries } = useTripWorkspace();

  const entries = React.useMemo(
    () => localEntries.filter((e) => e.tripId === tripId),
    [localEntries, tripId]
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
            <span className={styles.amount}>{formatNZD(lineTotal)}</span>
          </div>
        );
      })}
    </section>
  );
};
