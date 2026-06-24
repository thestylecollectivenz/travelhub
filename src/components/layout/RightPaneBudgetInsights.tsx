import * as React from 'react';
import { useTripWorkspace } from '../../context/TripWorkspaceContext';
import { useConfig } from '../../context/ConfigContext';
import { BUDGET_CATEGORY_ORDER, formatCurrency } from '../../utils/financialUtils';
import { buildBudgetDetailLines } from '../../utils/budgetDetailLines';
import { usePlaces } from '../../context/PlacesContext';
import { placeDisplayLabel } from '../../utils/placeDisplayLabel';
import styles from './RightPaneInsights.module.css';

export const RightPaneBudgetInsights: React.FC = () => {
  const { trip, localEntries, tripDays, convertToHomeCurrency } = useTripWorkspace();
  const { config } = useConfig();
  const { placeById } = usePlaces();

  const insights = React.useMemo(() => {
    if (!trip) {
      return { estimatedTotal: 0, confirmedTotal: 0, estimatedCount: 0, needsBooking: 0, unpaidCount: 0 };
    }
    const entries = localEntries.filter((e) => e.tripId === trip.id);
    const dayLabelFor = (dayId: string): string => {
      const d = tripDays.find((x) => x.id === dayId);
      if (!d) return '';
      return d.dayType === 'PreTrip' ? 'Pre-trip' : `Day ${d.dayNumber}`;
    };
    const locationFor = (entry: (typeof entries)[0]): string => {
      const direct = (entry.location || '').trim();
      if (direct) return direct;
      const day = tripDays.find((d) => d.id === entry.dayId);
      if (day?.primaryPlaceId) {
        const place = placeById(day.primaryPlaceId);
        if (place) return placeDisplayLabel(place);
      }
      return '';
    };

    let estimatedTotal = 0;
    let confirmedTotal = 0;
    let estimatedCount = 0;
    for (const cat of BUDGET_CATEGORY_ORDER) {
      const lines = buildBudgetDetailLines(
        entries,
        cat,
        convertToHomeCurrency,
        dayLabelFor,
        tripDays,
        (e, sub) => (sub?.location || locationFor(e))
      );
      for (const line of lines) {
        if (line.costCertainty === 'Estimated') {
          estimatedTotal += line.total;
          estimatedCount += 1;
        } else {
          confirmedTotal += line.total;
        }
      }
    }

    const needsBooking = entries.filter((e) => e.bookingRequired && e.bookingStatus !== 'Booked').length;
    const unpaidCount = entries.filter(
      (e) => e.paymentStatus !== 'Fully paid' && e.paymentStatus !== 'Free' && (e.amount ?? 0) > 0
    ).length;

    return { estimatedTotal, confirmedTotal, estimatedCount, needsBooking, unpaidCount };
  }, [trip, localEntries, tripDays, convertToHomeCurrency, placeById]);

  if (!trip) return null;
  const home = config.homeCurrency;

  return (
    <section className={styles.root} aria-label="Budget insights">
      <h2 className={styles.heading}>Budget insights</h2>
      <p className={styles.muted}>Breakdown and exceptions — totals are in the main panel above.</p>
      <div className={styles.statGrid}>
        <div className={styles.stat}>
          <span className={styles.statValue}>{formatCurrency(insights.estimatedTotal, home)}</span>
          <span className={styles.statLabel}>Estimated ({insights.estimatedCount} items)</span>
        </div>
        <div className={styles.stat}>
          <span className={styles.statValue}>{formatCurrency(insights.confirmedTotal, home)}</span>
          <span className={styles.statLabel}>Confirmed</span>
        </div>
        <div className={styles.stat}>
          <span className={styles.statValue}>{insights.unpaidCount}</span>
          <span className={styles.statLabel}>Unpaid items</span>
        </div>
        <div className={styles.stat}>
          <span className={styles.statValue}>{insights.needsBooking}</span>
          <span className={styles.statLabel}>Need booking</span>
        </div>
      </div>
    </section>
  );
};
