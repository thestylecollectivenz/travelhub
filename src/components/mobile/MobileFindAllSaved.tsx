import * as React from 'react';
import { useSpContext } from '../../context/SpContext';
import {
  deleteTripSavedSpot,
  loadTripSavedSpots,
  SAVED_SPOTS_CHANGED_EVENT,
  type TripSavedSpot
} from '../../utils/tripSavedSpots';
import { placeQueryDirectionsUrl } from '../../utils/googleMapsLink';
import { NEAR_YOU_TOOLS } from '../../utils/nearYouTools';
import styles from './MobileNearYouPage.module.css';

export interface MobileFindAllSavedProps {
  tripId?: string;
  onBack: () => void;
}

export const MobileFindAllSaved: React.FC<MobileFindAllSavedProps> = ({ tripId, onBack }) => {
  const spContext = useSpContext();
  const [rows, setRows] = React.useState<TripSavedSpot[]>([]);

  const refresh = React.useCallback(() => {
    if (!tripId) {
      setRows([]);
      return;
    }
    void loadTripSavedSpots(spContext, tripId).then(setRows).catch(console.error);
  }, [spContext, tripId]);

  React.useEffect(() => {
    refresh();
    const handler = (): void => refresh();
    window.addEventListener(SAVED_SPOTS_CHANGED_EVENT, handler);
    return () => window.removeEventListener(SAVED_SPOTS_CHANGED_EVENT, handler);
  }, [refresh]);

  const toolLabel = (toolId?: string): string => {
    if (!toolId) return 'Saved';
    return NEAR_YOU_TOOLS.find((t) => t.id === toolId)?.shortLabel || 'Saved';
  };

  return (
    <div className={styles.root}>
      <div className={styles.backRow}>
        <button type="button" className={styles.backBtn} onClick={onBack}>
          ← Near you
        </button>
      </div>
      <h2 className={styles.title}>Saved places</h2>
      <p className={styles.intro}>All places you have saved for this trip from Near you and Find.</p>
      {!tripId ? <p className={styles.intro}>Open a trip to see saved places.</p> : null}
      {tripId && !rows.length ? <p className={styles.intro}>No saved places yet.</p> : null}
      {rows.length ? (
        <ul className={styles.savedList}>
          {rows.map((row) => {
            const href = row.mapsUrl || placeQueryDirectionsUrl(row.name) || row.websiteUrl;
            return (
              <li key={row.id} className={styles.savedItem}>
                <div className={styles.savedMain}>
                  <strong className={styles.savedName}>{row.name}</strong>
                  <span className={styles.savedNote}>{toolLabel(row.toolId)}</span>
                  {row.note ? <p className={styles.savedNote}>{row.note}</p> : null}
                </div>
                <div className={styles.savedActions}>
                  {href ? (
                    <a className={styles.savedBtn} href={href} target="_blank" rel="noreferrer">
                      Open
                    </a>
                  ) : null}
                  <button
                    type="button"
                    className={styles.savedBtn}
                    onClick={() => {
                      void deleteTripSavedSpot(spContext, row.id).then(refresh);
                    }}
                  >
                    Remove
                  </button>
                </div>
              </li>
            );
          })}
        </ul>
      ) : null}
    </div>
  );
};
