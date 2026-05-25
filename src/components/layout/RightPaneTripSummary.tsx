import * as React from 'react';
import { useTripWorkspace } from '../../context/TripWorkspaceContext';
import { useConfig } from '../../context/ConfigContext';
import { avgPerDay, formatCurrency, sumByPaymentStatus } from '../../utils/financialUtils';
import { isPreTripDayRow } from '../../utils/itineraryDayEntries';
import styles from './RightPaneTripSummary.module.css';

export interface RightPaneTripSummaryProps {
  showSelectDayHint?: boolean;
}

function formatTripDates(start: string, end: string): string {
  const fmt = (d: string): string => {
    const dt = new Date(d);
    if (Number.isNaN(dt.getTime())) return d;
    return dt.toLocaleDateString('en-NZ', { day: 'numeric', month: 'short', year: 'numeric' });
  };
  if (!start && !end) return '';
  if (start && end) return `${fmt(start)} – ${fmt(end)}`;
  return fmt(start || end);
}

export const RightPaneTripSummary: React.FC<RightPaneTripSummaryProps> = ({ showSelectDayHint = false }) => {
  const { trip, localEntries, tripDays, convertToHomeCurrency } = useTripWorkspace();
  const { config } = useConfig();

  if (!trip) return null;

  const entries = localEntries.filter((e) => e.tripId === trip.id);
  const totalBudget = sumByPaymentStatus(entries, 'all', convertToHomeCurrency);
  const spentSoFar = sumByPaymentStatus(entries, 'paid', convertToHomeCurrency);
  const remaining = sumByPaymentStatus(entries, 'unpaid', convertToHomeCurrency);
  const dayCount = tripDays.filter((d) => d.tripId === trip.id && !isPreTripDayRow(d)).length;
  const averagePerDay = avgPerDay(totalBudget, dayCount);

  const rows = [
    { label: 'Total budget', value: formatCurrency(totalBudget, config.homeCurrency) },
    { label: 'Spent so far', value: formatCurrency(spentSoFar, config.homeCurrency) },
    { label: 'Remaining', value: formatCurrency(remaining, config.homeCurrency) },
    { label: 'Avg per day', value: formatCurrency(averagePerDay, config.homeCurrency) }
  ];

  const durationLabel =
    dayCount > 0 ? `${formatTripDates(trip.dateStart, trip.dateEnd)} · ${dayCount} day${dayCount === 1 ? '' : 's'}` : formatTripDates(trip.dateStart, trip.dateEnd);

  return (
    <section className={styles.root} aria-label="Trip summary">
      <h2 className={styles.title}>{trip.title?.trim() || 'Trip'}</h2>
      {durationLabel ? <p className={styles.meta}>{durationLabel}</p> : null}
      {trip.status ? <span className={styles.badge}>{trip.status}</span> : null}
      <div className={styles.cards}>
        {rows.map((r) => (
          <div className={styles.card} key={r.label}>
            <span className={styles.cardLabel}>{r.label}</span>
            <span className={styles.cardValue}>{r.value}</span>
          </div>
        ))}
      </div>
      {showSelectDayHint ? (
        <p className={styles.hint}>Select a day to see place and budget details for that day.</p>
      ) : null}
    </section>
  );
};
