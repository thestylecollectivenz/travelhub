import * as React from 'react';
import { CategoryIcon } from '../shared/CategoryIcon';
import { useTripWorkspace } from '../../context/TripWorkspaceContext';
import { useConfig } from '../../context/ConfigContext';
import { getCategorySlug } from '../../utils/categoryUtils';
import { BUDGET_CATEGORY_ORDER, formatCurrency, sumByCategory, sumByPaymentStatus } from '../../utils/financialUtils';
import { isPreTripDayRow } from '../../utils/itineraryDayEntries';
import styles from './TripBudgetDetailView.module.css';

export const TripBudgetDetailView: React.FC = () => {
  const { trip, localEntries, tripDays, convertToHomeCurrency } = useTripWorkspace();
  const { config } = useConfig();

  const entries = React.useMemo(
    () => (trip ? localEntries.filter((e) => e.tripId === trip.id) : []),
    [localEntries, trip]
  );

  const totals = React.useMemo(() => sumByCategory(entries, convertToHomeCurrency), [entries, convertToHomeCurrency]);
  const totalBudget = sumByPaymentStatus(entries, 'all', convertToHomeCurrency);
  const spentSoFar = sumByPaymentStatus(entries, 'paid', convertToHomeCurrency);
  const remaining = sumByPaymentStatus(entries, 'unpaid', convertToHomeCurrency);
  const tripDayCount = tripDays.filter((d) => trip && d.tripId === trip.id && !isPreTripDayRow(d)).length;

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
      </div>

      <h2 className={styles.sectionTitle}>By category</h2>
      <div className={styles.categoryList}>
        {BUDGET_CATEGORY_ORDER.map((key) => {
          const amount = totals[key] ?? 0;
          const isZero = amount === 0;
          const categorySlug = getCategorySlug(key);
          return (
            <div key={key} className={styles.categoryRow}>
              <span className={isZero ? undefined : `th-cat-${categorySlug} th-cat-icon`}>
                <CategoryIcon category={key} size={16} color={isZero ? 'var(--color-sand-400)' : 'currentColor'} />
              </span>
              <span className={styles.categoryName}>{key}</span>
              <span className={`${styles.categoryAmount} ${isZero ? styles.zero : ''}`}>
                {isZero ? '—' : formatCurrency(amount, config.homeCurrency)}
              </span>
            </div>
          );
        })}
      </div>
    </section>
  );
};
