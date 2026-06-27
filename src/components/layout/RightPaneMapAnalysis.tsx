import * as React from 'react';
import { useTripWorkspace } from '../../context/TripWorkspaceContext';
import { usePlaces } from '../../context/PlacesContext';
import { buildPlacesVisitAnalytics, buildPlaceDetailStats } from '../../utils/placesVisitAnalytics';
import { MAP_PLACE_SELECT_EVENT, type MapPlaceSelectDetail } from '../../utils/mapPlaceSelection';
import styles from './RightPaneInsights.module.css';

export const RightPaneMapAnalysis: React.FC = () => {
  const { trip, tripDays, localEntries } = useTripWorkspace();
  const { placeById } = usePlaces();
  const [selected, setSelected] = React.useState<MapPlaceSelectDetail | null>(null);

  React.useEffect(() => {
    const handler = (event: Event): void => {
      setSelected((event as CustomEvent<MapPlaceSelectDetail | null>).detail ?? null);
    };
    window.addEventListener(MAP_PLACE_SELECT_EVENT, handler);
    return () => window.removeEventListener(MAP_PLACE_SELECT_EVENT, handler);
  }, []);

  const analytics = React.useMemo(() => {
    if (!trip) {
      return {
        uniquePlaces: 0,
        multiDayPlaces: 0,
        returnVisitPlaces: 0,
        avgStayNights: 0,
        longestStayNights: 0,
        totalActivities: 0
      };
    }
    const entries = localEntries.filter((e) => e.tripId === trip.id);
    return buildPlacesVisitAnalytics(tripDays.filter((d) => d.tripId === trip.id), entries, placeById);
  }, [trip, tripDays, localEntries, placeById]);

  const placeDetail = React.useMemo(() => {
    if (!selected?.placeKey || !trip) return undefined;
    const entries = localEntries.filter((e) => e.tripId === trip.id);
    return buildPlaceDetailStats(selected.placeKey, tripDays, entries, placeById);
  }, [selected, trip, tripDays, localEntries, placeById]);

  if (!trip) return null;

  const tripDayCount = tripDays.filter((d) => d.tripId === trip.id && d.dayType !== 'PreTrip').length;

  return (
    <section className={styles.root} aria-label="Map analysis">
      <h2 className={styles.heading}>Trip geography</h2>
      <div className={styles.statGrid}>
        <div className={styles.stat}>
          <span className={styles.statValue}>{analytics.uniquePlaces}</span>
          <span className={styles.statLabel}>Unique places</span>
        </div>
        <div className={styles.stat}>
          <span className={styles.statValue}>{tripDayCount}</span>
          <span className={styles.statLabel}>Trip days</span>
        </div>
        <div className={styles.stat}>
          <span className={styles.statValue}>{analytics.multiDayPlaces}</span>
          <span className={styles.statLabel}>Multi-day stays</span>
        </div>
        <div className={styles.stat}>
          <span className={styles.statValue}>{analytics.returnVisitPlaces}</span>
          <span className={styles.statLabel}>Return visits</span>
        </div>
        <div className={styles.stat}>
          <span className={styles.statValue}>{analytics.avgStayNights}</span>
          <span className={styles.statLabel}>Avg stay (nights)</span>
        </div>
        <div className={styles.stat}>
          <span className={styles.statValue}>{analytics.longestStayNights}</span>
          <span className={styles.statLabel}>Longest stay</span>
        </div>
        <div className={styles.stat}>
          <span className={styles.statValue}>{analytics.totalActivities}</span>
          <span className={styles.statLabel}>Activities logged</span>
        </div>
        <div className={styles.stat}>
          <span className={styles.statValue}>
            {analytics.uniquePlaces > 0 ? Math.round((tripDayCount / analytics.uniquePlaces) * 10) / 10 : 0}
          </span>
          <span className={styles.statLabel}>Avg days per place</span>
        </div>
      </div>

      {placeDetail ? (
        <>
          <h3 className={styles.subheading}>{placeDetail.label}</h3>
          <ul className={styles.list}>
            <li className={styles.listItem}>
              Days {placeDetail.dayNumbers.join(', ')} · {placeDetail.stayNights} night
              {placeDetail.stayNights === 1 ? '' : 's'}
              {placeDetail.visitBlocks > 1 ? ` · ${placeDetail.visitBlocks} separate visits` : ''}
            </li>
            <li className={styles.listItem}>{placeDetail.activityCount} planned activit{placeDetail.activityCount === 1 ? 'y' : 'ies'}</li>
            {placeDetail.prevPlaceLabel && placeDetail.distanceFromPrevKm != null ? (
              <li className={styles.listItem}>
                {placeDetail.distanceFromPrevKm} km from {placeDetail.prevPlaceLabel}
              </li>
            ) : null}
            {placeDetail.nextPlaceLabel && placeDetail.distanceToNextKm != null ? (
              <li className={styles.listItem}>
                {placeDetail.distanceToNextKm} km to {placeDetail.nextPlaceLabel}
              </li>
            ) : null}
          </ul>
        </>
      ) : (
        <p className={styles.muted}>Select a place in the left sidebar to see stay and activity detail.</p>
      )}
    </section>
  );
};
