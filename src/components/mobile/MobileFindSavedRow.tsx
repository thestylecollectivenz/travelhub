import * as React from 'react';
import {
  loadNearYouSavedPlaces,
  removeNearYouSavedPlace,
  updateNearYouSavedPlaceNote,
  type NearYouSavedPlace
} from '../../utils/nearYouSavedPlaces';
import { placeQueryDirectionsUrl } from '../../utils/googleMapsLink';
import type { NearYouToolId } from '../../utils/nearYouTools';
import styles from './MobileNearYouPage.module.css';

export interface MobileFindSavedRowProps {
  toolId: NearYouToolId;
}

export const MobileFindSavedRow: React.FC<MobileFindSavedRowProps> = ({ toolId }) => {
  const [rows, setRows] = React.useState<NearYouSavedPlace[]>([]);
  const [open, setOpen] = React.useState(false);
  const [editingId, setEditingId] = React.useState<string | null>(null);
  const [noteDraft, setNoteDraft] = React.useState('');

  const refresh = React.useCallback(() => {
    setRows(loadNearYouSavedPlaces().filter((x) => x.toolId === toolId));
  }, [toolId]);

  React.useEffect(() => {
    refresh();
    const handler = (): void => refresh();
    window.addEventListener('travelhub-near-you-saved-changed', handler);
    return () => window.removeEventListener('travelhub-near-you-saved-changed', handler);
  }, [refresh]);

  if (!rows.length) return null;

  return (
    <div className={styles.savedBlock}>
      <button type="button" className={styles.savedToggle} onClick={() => setOpen((v) => !v)} aria-expanded={open}>
        <span>
          Saved ({rows.length})
        </span>
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
                          updateNearYouSavedPlaceNote(row.id, noteDraft);
                          setEditingId(null);
                          setNoteDraft('');
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
                      <button type="button" className={styles.savedBtnDanger} onClick={() => removeNearYouSavedPlace(row.id)}>
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
