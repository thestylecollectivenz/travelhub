import * as React from 'react';
import { useTripWorkspace } from '../../context/TripWorkspaceContext';
import { usePlaces } from '../../context/PlacesContext';
import { buildPlacesVisitSummary } from '../../utils/placesVisitSummary';
import styles from './RightPaneInsights.module.css';

export const RightPaneMapAnalysis: React.FC = () => {
  const { trip, tripDays, localEntries } = useTripWorkspace();
  const { placeById } = usePlaces();

  const summary = React.useMemo(() => {
    if (!trip) return { uniquePlaces: 0, rows: [] };
    const entries = localEntries.filter((e) => e.tripId === trip.id);
    return buildPlacesVisitSummary(tripDays.filter((d) => d.tripId === trip.id), entries, placeById);
  }, [trip, tripDays, localEntries, placeById]);

  if (!trip) return null;

  return (
    <section className={styles.root} aria-label="Places visited">
      <h2 className={styles.heading}>Places &amp; stops</h2>
      <div className={styles.statGrid}>
        <div className={styles.stat}>
          <span className={styles.statValue}>{summary.uniquePlaces}</span>
          <span className={styles.statLabel}>Unique places</span>
        </div>
        <div className={styles.stat}>
          <span className={styles.statValue}>
            {tripDays.filter((d) => d.tripId === trip.id && d.dayType !== 'PreTrip').length}
          </span>
          <span className={styles.statLabel}>Trip days</span>
        </div>
      </div>
      {summary.rows.length === 0 ? (
        <p className={styles.muted}>Add day places or itinerary locations to build a visit summary.</p>
      ) : (
        <>
          <h3 className={styles.subheading}>By place</h3>
          <ul className={styles.list}>
            {summary.rows.slice(0, 24).map((row) => (
              <li key={row.label} className={styles.listItem}>
                <strong>{row.label}</strong>
                {row.dayNumbers.length ? (
                  <span>
                    {' '}
                    · Day{row.dayNumbers.length === 1 ? '' : 's'}{' '}
                    {row.dayNumbers.join(', ')}
                  </span>
                ) : null}
                {row.entryCount > 0 ? <span> · {row.entryCount} itinerary item{row.entryCount === 1 ? '' : 's'}</span> : null}
              </li>
            ))}
          </ul>
          {summary.rows.length > 24 ? (
            <p className={styles.muted}>+ {summary.rows.length - 24} more places</p>
          ) : null}
        </>
      )}
    </section>
  );
};
