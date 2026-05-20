import * as React from 'react';
import { useTripWorkspace } from '../../context/TripWorkspaceContext';
import { usePlaces } from '../../context/PlacesContext';
import { parseAdditionalPlaceRefs } from '../../utils/tripDayPlaces';
import { isPreTripDayRow } from '../../utils/itineraryDayEntries';
import { requestMapFocus } from '../../utils/mapFocus';
import styles from './TripSidebar.module.css';

interface MapStopRow {
  id: string;
  title: string;
  latitude: number;
  longitude: number;
  dayLabel: string;
}

export const SidebarMapStops: React.FC = () => {
  const { trip, tripDays } = useTripWorkspace();
  const { placeById } = usePlaces();

  const stops = React.useMemo((): MapStopRow[] => {
    if (!trip) return [];
    const ordered = tripDays
      .filter((d) => d.tripId === trip.id && !isPreTripDayRow(d))
      .sort((a, b) => a.dayNumber - b.dayNumber);
    const out: MapStopRow[] = [];
    for (const day of ordered) {
      const primary = placeById(day.primaryPlaceId);
      if (primary) {
        const lat = Number(primary.latitude);
        const lon = Number(primary.longitude);
        if (Number.isFinite(lat) && Number.isFinite(lon)) {
          out.push({
            id: `${primary.id}-${day.id}`,
            title: primary.title,
            latitude: lat,
            longitude: lon,
            dayLabel: `Day ${day.dayNumber} — ${day.displayTitle}`
          });
        }
      }
      const additional = parseAdditionalPlaceRefs(day.additionalPlaceIds);
      for (const ref of additional) {
        const add = placeById(ref.placeId);
        if (!add) continue;
        const lat = Number(add.latitude);
        const lon = Number(add.longitude);
        if (!Number.isFinite(lat) || !Number.isFinite(lon)) continue;
        out.push({
          id: `${add.id}-${day.id}-add`,
          title: add.title,
          latitude: lat,
          longitude: lon,
          dayLabel: `Day ${day.dayNumber} (visit)`
        });
      }
    }
    return out;
  }, [trip, tripDays, placeById]);

  if (!stops.length) {
    return (
      <div className={styles.dayListSection}>
        <p className={styles.dayListHint}>No map pins yet. Set overnight or visited places on each day.</p>
      </div>
    );
  }

  return (
    <div className={styles.dayListSection}>
      <h2 className={styles.dayListHeading}>Map stops</h2>
      <p className={styles.dayListHint}>Select a stop to centre the map.</p>
      <ul className={styles.dayList}>
        {stops.map((s) => (
          <li key={s.id}>
            <button
              type="button"
              className={styles.mapStopBtn}
              onClick={() => requestMapFocus(s.latitude, s.longitude, s.title)}
            >
              <span className={styles.mapStopTitle}>{s.title.split(',')[0]}</span>
              <span className={styles.mapStopMeta}>{s.dayLabel}</span>
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
};
