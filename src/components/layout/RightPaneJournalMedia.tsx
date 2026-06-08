import * as React from 'react';
import type { TripDay } from '../../models/TripDay';
import { useJournal } from '../../context/JournalContext';
import { useJournalMediaSelection } from '../../context/JournalMediaSelectionContext';
import { useTripWorkspace } from '../../context/TripWorkspaceContext';
import { confirmUserAction } from '../../utils/confirmAction';
import styles from './RightPaneJournalMedia.module.css';

export interface RightPaneJournalMediaProps {
  journalDays: TripDay[];
}

export const RightPaneJournalMedia: React.FC<RightPaneJournalMediaProps> = ({ journalDays }) => {
  const { allTripPhotos, allEntries, assignPhotoToEntry, deletePhoto } = useJournal();
  const { selectedPhotoId, setSelectedPhotoId } = useJournalMediaSelection();
  const { sharedPreview } = useTripWorkspace();

  const photo = React.useMemo(
    () => allTripPhotos.find((p) => p.id === selectedPhotoId) ?? null,
    [allTripPhotos, selectedPhotoId]
  );

  const [dayId, setDayId] = React.useState('');
  const [entryId, setEntryId] = React.useState('');

  React.useEffect(() => {
    if (!photo) {
      setDayId('');
      setEntryId('');
      return;
    }
    setDayId(photo.dayId || journalDays[0]?.id || '');
    setEntryId(photo.journalEntryId || '');
  }, [photo, journalDays]);

  const entriesForDay = React.useMemo(() => {
    if (!dayId) return [];
    return allEntries
      .filter((e) => e.dayId === dayId)
      .sort((a, b) => a.entryTimestamp.localeCompare(b.entryTimestamp));
  }, [allEntries, dayId]);

  const unassigned = React.useMemo(
    () => allTripPhotos.filter((p) => !p.journalEntryId?.trim()).slice(0, 6),
    [allTripPhotos]
  );

  const saveAssociation = (): void => {
    if (!photo || !dayId) return;
    assignPhotoToEntry(photo.id, dayId, entryId).catch(console.error);
  };

  if (sharedPreview) return null;

  return (
    <section className={styles.root} aria-label="Photo association">
      <h3 className={styles.title}>Journal photos</h3>
      <p className={styles.hint}>Select a photo to assign it to a day and journal entry, or drag photos onto an entry card.</p>

      {photo ? (
        <>
          <img className={styles.preview} src={photo.fileUrl} alt="" />
          <label className={styles.field}>
            <span>Day</span>
            <select
              className={styles.select}
              value={dayId}
              onChange={(e) => {
                setDayId(e.target.value);
                setEntryId('');
              }}
              aria-label="Photo day"
            >
              {journalDays.map((d) => (
                <option key={d.id} value={d.id}>
                  {d.dayType === 'PreTrip' ? 'Pre-trip' : `Day ${d.dayNumber} — ${d.displayTitle}`}
                </option>
              ))}
            </select>
          </label>
          <label className={styles.field}>
            <span>Journal entry</span>
            <select className={styles.select} value={entryId} onChange={(e) => setEntryId(e.target.value)} aria-label="Photo journal entry">
              <option value="">Album only (no entry)</option>
              {entriesForDay.map((e, i) => (
                <option key={e.id} value={e.id}>
                  Entry {i + 1} — {new Date(e.entryTimestamp).toLocaleString()}
                </option>
              ))}
            </select>
          </label>
          <div className={styles.actions}>
            <button type="button" className={`${styles.btn} ${styles.btnPrimary}`} onClick={saveAssociation}>
              Save association
            </button>
            <button type="button" className={styles.btn} onClick={() => setSelectedPhotoId(null)}>
              Clear selection
            </button>
            <button
              type="button"
              className={`${styles.btn} ${styles.btnDanger}`}
              onClick={() => {
                void (async () => {
                  if (!(await confirmUserAction('Delete this photo?'))) return;
                  deletePhoto(photo.id)
                    .then(() => setSelectedPhotoId(null))
                    .catch(console.error);
                })();
              }}
            >
              Delete photo
            </button>
          </div>
        </>
      ) : unassigned.length ? (
        <>
          <p className={styles.hint}>Unassigned album photos — click to assign:</p>
          <ul className={styles.unassignedList}>
            {unassigned.map((p) => (
              <li key={p.id}>
                <button type="button" className={styles.unassignedItem} onClick={() => setSelectedPhotoId(p.id)}>
                  <img className={styles.unassignedThumb} src={p.fileUrl} alt="" />
                  <span>{p.caption?.trim() || 'Photo'}</span>
                </button>
              </li>
            ))}
          </ul>
        </>
      ) : (
        <p className={styles.hint}>Click a photo in the album or journal to manage it here.</p>
      )}
    </section>
  );
};
