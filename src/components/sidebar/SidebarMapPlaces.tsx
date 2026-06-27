import * as React from 'react';
import { useTripWorkspace } from '../../context/TripWorkspaceContext';
import { usePlaces } from '../../context/PlacesContext';
import { orderedPlaceStopsForSidebar } from '../../utils/placesVisitAnalytics';
import { MAP_PLACE_SELECT_EVENT, requestMapPlaceSelect, type MapPlaceSelectDetail } from '../../utils/mapPlaceSelection';
import { requestMapFocus } from '../../utils/mapFocus';
import styles from './TripSidebar.module.css';

export const SidebarMapPlaces: React.FC = () => {
  const { tripDays } = useTripWorkspace();
  const { placeById } = usePlaces();
  const [selectedKey, setSelectedKey] = React.useState<string | null>(null);

  const stops = React.useMemo(() => orderedPlaceStopsForSidebar(tripDays, placeById), [tripDays, placeById]);

  React.useEffect(() => {
    const handler = (event: Event): void => {
      const detail = (event as CustomEvent<MapPlaceSelectDetail | null>).detail;
      setSelectedKey(detail?.placeKey ?? null);
    };
    window.addEventListener(MAP_PLACE_SELECT_EVENT, handler);
    return () => window.removeEventListener(MAP_PLACE_SELECT_EVENT, handler);
  }, []);

  if (!stops.length) {
    return (
      <div className={styles.dayListSection}>
        <p className={styles.dayListHint}>Set a primary place on trip days to build a visit list.</p>
      </div>
    );
  }

  return (
    <div className={styles.dayListSection}>
      <h2 className={styles.dayListHeading}>Places</h2>
      <p className={styles.dayListHint}>Select a place for stats in the right panel.</p>
      <ul className={styles.dayList}>
        {stops.map((stop) => (
          <li key={stop.placeKey}>
            <button
              type="button"
              className={`${styles.mapStopBtn} ${selectedKey === stop.placeKey ? styles.packingCatBtnActive : ''}`}
              onClick={() => {
                requestMapPlaceSelect({ placeKey: stop.placeKey, label: stop.label, placeId: stop.placeId });
                if (stop.placeId) {
                  const place = placeById(stop.placeId);
                  if (place?.latitude && place?.longitude) {
                    requestMapFocus(place.latitude, place.longitude, stop.label);
                  }
                }
              }}
            >
              <span className={styles.mapStopTitle}>{stop.label}</span>
              <span className={styles.dayListHint}>
                Day{stop.dayNumbers.length === 1 ? '' : 's'} {stop.dayNumbers.join(', ')}
              </span>
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
};
