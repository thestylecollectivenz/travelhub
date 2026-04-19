import * as React from 'react';
import { CategoryIcon } from '../shared/CategoryIcon';
import { useTripWorkspace } from '../../context/TripWorkspaceContext';
import { MOCK_ITINERARY_ENTRIES } from '../../mocks/tripMock';
import { BUDGET_CATEGORY_ORDER, formatNZD, sumByCategory } from '../../utils/financialUtils';
import styles from './SidebarCategoryBudget.module.css';

export const SidebarCategoryBudget: React.FC = () => {
  const { trip } = useTripWorkspace();

  const entries = React.useMemo(
    () => MOCK_ITINERARY_ENTRIES.filter((e) => e.tripId === trip.id),
    [trip.id]
  );

  const totals = React.useMemo(() => sumByCategory(entries), [entries]);

  return (
    <section className={styles.section} aria-label="Trip budget by category">
      <h2 className={styles.heading}>Trip budget</h2>
      <div className={styles.body}>
        {BUDGET_CATEGORY_ORDER.map((key) => {
          const amount = totals[key] ?? 0;
          const isZero = amount === 0;
          return (
            <div key={key} className={styles.row}>
              <div className={styles.rowLeft}>
                <CategoryIcon category={key} size={14} />
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
