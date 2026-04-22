import * as React from 'react';
import { CategoryIcon } from '../shared/CategoryIcon';
import { useTripWorkspace } from '../../context/TripWorkspaceContext';
import { getCategorySlug } from '../../utils/categoryUtils';
import { BUDGET_CATEGORY_ORDER, formatNZD, sumByCategory } from '../../utils/financialUtils';
import styles from './SidebarCategoryBudget.module.css';

export const SidebarCategoryBudget: React.FC = () => {
  const { trip, localEntries, convertToNZD } = useTripWorkspace();

  const entries = React.useMemo(
    () => (trip ? localEntries.filter((e) => e.tripId === trip.id) : []),
    [localEntries, trip]
  );

  const totals = React.useMemo(() => sumByCategory(entries, convertToNZD), [entries, convertToNZD]);

  return (
    <section className={styles.section} aria-label="Trip budget by category">
      <h2 className={styles.heading}>Trip budget</h2>
      <div className={styles.body}>
        {BUDGET_CATEGORY_ORDER.map((key) => {
          const amount = totals[key] ?? 0;
          const isZero = amount === 0;
          const categorySlug = getCategorySlug(key);
          return (
            <div key={key} className={styles.row}>
              <div className={styles.rowLeft}>
                <span className={isZero ? undefined : `th-cat-${categorySlug} th-cat-icon`}>
                  <CategoryIcon category={key} size={14} color={isZero ? 'var(--color-sand-400)' : 'currentColor'} />
                </span>
                <span className={styles.label}>{key}</span>
              </div>
              <span className={`${styles.total} ${isZero ? styles.totalZero : ''}`}>
                {isZero ? '—' : formatNZD(amount)}
              </span>
            </div>
          );
        })}
      </div>
    </section>
  );
};
