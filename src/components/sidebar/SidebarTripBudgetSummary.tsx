import * as React from 'react';
import { useTripWorkspace } from '../../context/TripWorkspaceContext';
import { useConfig } from '../../context/ConfigContext';
import { avgPerDay, formatCurrency, sumByPaymentStatus } from '../../utils/financialUtils';
import { isPreTripDayRow } from '../../utils/itineraryDayEntries';
import styles from './SidebarTripBudgetSummary.module.css';

/** Compact trip budget summary for the left sidebar on the Budget tab. */
export const SidebarTripBudgetSummary: React.FC = () => {
  const { trip, localEntries, tripDays, convertToHomeCurrency } = useTripWorkspace();
  const { config } = useConfig();

  const entries = React.useMemo(
    () => (trip ? localEntries.filter((e) => e.tripId === trip.id) : []),
    [localEntries, trip]
  );

  const totalBudget = sumByPaymentStatus(entries, 'all', convertToHomeCurrency);
  const spentSoFar = sumByPaymentStatus(entries, 'paid', convertToHomeCurrency);
  const remaining = sumByPaymentStatus(entries, 'unpaid', convertToHomeCurrency);
  const dayCount = tripDays.filter((d) => trip && d.tripId === trip.id && !isPreTripDayRow(d)).length;
  const averagePerDay = avgPerDay(totalBudget, dayCount);

  const rows = [
    { label: 'Total budget', value: formatCurrency(totalBudget, config.homeCurrency) },
    { label: 'Spent so far', value: formatCurrency(spentSoFar, config.homeCurrency) },
    { label: 'Remaining', value: formatCurrency(remaining, config.homeCurrency) },
    { label: 'Avg per day', value: formatCurrency(averagePerDay, config.homeCurrency) }
  ];

  return (
    <section className={styles.root} aria-label="Trip budget summary">
      <h2 className={styles.heading}>Trip budget</h2>
      {rows.map((r) => (
        <div className={styles.row} key={r.label}>
          <span className={styles.label}>{r.label}</span>
          <span className={styles.value}>{r.value}</span>
        </div>
      ))}
      <p className={styles.hint}>Open the main panel for category breakdown and day-level detail.</p>
    </section>
  );
};
