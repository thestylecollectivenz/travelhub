import * as React from 'react';
import { useSpContext } from '../../context/SpContext';
import {
  deleteTripSavedSpot,
  loadTripSavedSpots,
  SAVED_SPOTS_CHANGED_EVENT,
  updateTripSavedSpotNote,
  type TripSavedSpot
} from '../../utils/tripSavedSpots';
import { placeQueryDirectionsUrl } from '../../utils/googleMapsLink';
import type { NearYouToolId } from '../../utils/nearYouTools';
import styles from './MobileNearYouPage.module.css';

export interface MobileFindSavedRowProps {
  toolId: NearYouToolId;
  tripId?: string;
}

export const MobileFindSavedRow: React.FC<MobileFindSavedRowProps> = ({ toolId, tripId }) => {
  const spContext = useSpContext();
  const [rows, setRows] = React.useState<TripSavedSpot[]>([]);
  const [open, setOpen] = React.useState(false);
  const [editingId, setEditingId] = React.useState<string | null>(null);
  const [noteDraft, setNoteDraft] = React.useState('');

  const refresh = React.useCallback(() => {
    if (!tripId) {
      setRows([]);
      return;
    }
    void loadTripSavedSpots(spContext, tripId)
      .then((all) => setRows(all.filter((x) => x.toolId === toolId)))
      .catch(console.error);
  }, [spContext, tripId, toolId]);

  React.useEffect(() => {
    refresh();
    const handler = (): void => refresh();
    window.addEventListener(SAVED_SPOTS_CHANGED_EVENT, handler);
    return () => window.removeEventListener(SAVED_SPOTS_CHANGED_EVENT, handler);
  }, [refresh]);

  if (!tripId || !rows.length) return null;

  return (
    <div className={styles.savedBlock}>
      <button type="button" className={styles.savedToggle} onClick={() => setOpen((v) => !v)} aria-expanded={open}>
        <span>Saved ({rows.length})</span>
        <span aria-hidden>{open ? '▾' : '▸'}</span>
      </button>
      {open ? (
        <ul className={styles.savedList}>
          {rows.map((row) => {
            const href = row.mapsUrl || placeQueryDirectionsUrl(row.name) || row.websiteUrl;
            const editing = editingId === row.id;
            return (
              <li key={row.id} className={styles.savedItem}>
                <div className={styles.savedMain}>
                  <strong className={styles.savedName}>{row.name}</strong>
                  {editing ? (
                    <textarea
                      className={styles.savedNoteInput}
                      value={noteDraft}
                      onChange={(e) => setNoteDraft(e.target.value)}
                      rows={2}
                      aria-label="Note for saved place"
                    />
                  ) : row.note ? (
                    <p className={styles.savedNote}>{row.note}</p>
                  ) : null}
                </div>
                <div className={styles.savedActions}>
                  {editing ? (
                    <>
                      <button
                        type="button"
                        className={styles.savedBtn}
                        onClick={() => {
                          void updateTripSavedSpotNote(spContext, row.id, noteDraft).then(() => {
                            setEditingId(null);
                            setNoteDraft('');
                            refresh();
                          });
                        }}
                      >
                        Save note
                      </button>
                      <button
                        type="button"
                        className={styles.savedBtn}
                        onClick={() => {
                          setEditingId(null);
                          setNoteDraft('');
                        }}
                      >
                        Cancel
                      </button>
                    </>
                  ) : (
                    <>
                      {href ? (
                        <a className={styles.savedBtn} href={href} target="_blank" rel="noopener noreferrer">
                          Open
                        </a>
                      ) : null}
                      <button
                        type="button"
                        className={styles.savedBtn}
                        onClick={() => {
                          setEditingId(row.id);
                          setNoteDraft(row.note || '');
                        }}
                      >
                        Note
                      </button>
                      <button
                        type="button"
                        className={styles.savedBtnDanger}
                        onClick={() => {
                          void deleteTripSavedSpot(spContext, row.id).then(refresh);
                        }}
                      >
                        Delete
                      </button>
                    </>
                  )}
                </div>
              </li>
            );
          })}
        </ul>
      ) : null}
    </div>
  );
};
