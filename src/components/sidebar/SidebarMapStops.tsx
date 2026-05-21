import * as React from 'react';
import { useTripWorkspace } from '../../context/TripWorkspaceContext';
import { usePlaces } from '../../context/PlacesContext';
import { buildMapTransportStops } from '../../utils/mapTransportStops';
import { requestMapFocus } from '../../utils/mapFocus';
import styles from './TripSidebar.module.css';

export const SidebarMapStops: React.FC = () => {
  const { trip, tripDays, localEntries } = useTripWorkspace();
  const { placeById } = usePlaces();

  const stops = React.useMemo(() => {
    if (!trip) return [];
    return buildMapTransportStops({
      tripId: trip.id,
      tripDays,
      entries: localEntries,
      placeById
    });
  }, [trip, tripDays, localEntries, placeById]);

  if (!stops.length) {
    return (
      <div className={styles.dayListSection}>
        <p className={styles.dayListHint}>No transport map stops yet (flights, cruise, transport).</p>
      </div>
    );
  }

  return (
    <div className={styles.dayListSection}>
      <h2 className={styles.dayListHeading}>Transport stops</h2>
      <p className={styles.dayListHint}>Select a stop to centre the map.</p>
      <ul className={styles.dayList}>
        {stops.map((s) => (
          <li key={s.id}>
            <button
              type="button"
              className={styles.mapStopBtn}
              onClick={() => requestMapFocus(s.latitude, s.longitude, s.title)}
            >
              <span className={styles.mapStopTitle}>{s.label}</span>
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
};
