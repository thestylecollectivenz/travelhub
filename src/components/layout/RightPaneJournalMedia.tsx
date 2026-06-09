import * as React from 'react';
import type { TripDay } from '../../models/TripDay';
import { useJournal } from '../../context/JournalContext';
import { useJournalMediaSelection } from '../../context/JournalMediaSelectionContext';
import { useTripWorkspace } from '../../context/TripWorkspaceContext';
import { JournalPhotoBoard } from '../journal/JournalPhotoBoard';
import { compareJournalPhotos } from '../../utils/compareJournalPhotos';
import { confirmUserAction } from '../../utils/confirmAction';
import styles from './RightPaneJournalMedia.module.css';

type PhotoPanelView = 'all' | 'day' | 'entry';

export interface RightPaneJournalMediaProps {
  journalDays: TripDay[];
}

export const RightPaneJournalMedia: React.FC<RightPaneJournalMediaProps> = ({ journalDays }) => {
  const { allTripPhotos, allEntries, photosForEntry, assignPhotoToEntry, deletePhoto, updatePhotoCaption } = useJournal();
  const { selectedPhotoId, setSelectedPhotoId, setSelectedEntryId, clearMediaSelection } = useJournalMediaSelection();
  const { trip, sharedPreview } = useTripWorkspace();

  const photo = React.useMemo(
    () => allTripPhotos.find((p) => p.id === selectedPhotoId) ?? null,
    [allTripPhotos, selectedPhotoId]
  );

  const [panelView, setPanelView] = React.useState<PhotoPanelView>('all');
  const [filterDayId, setFilterDayId] = React.useState(journalDays[0]?.id ?? '');
  const [filterEntryId, setFilterEntryId] = React.useState('');
  const [dayId, setDayId] = React.useState('');
  const [entryId, setEntryId] = React.useState('');
  const [capDraft, setCapDraft] = React.useState('');
  const [editingCap, setEditingCap] = React.useState(false);

  React.useEffect(() => {
    if (!filterDayId && journalDays[0]?.id) {
      setFilterDayId(journalDays[0].id);
    }
  }, [filterDayId, journalDays]);

  React.useEffect(() => {
    if (!filterEntryId && allEntries.length) {
      setFilterEntryId(allEntries[0].id);
    }
  }, [filterEntryId, allEntries]);

  React.useEffect(() => {
    if (!photo) {
      setDayId('');
      setEntryId('');
      setCapDraft('');
      setEditingCap(false);
      return;
    }
    setDayId(photo.dayId || journalDays[0]?.id || '');
    setEntryId(photo.journalEntryId || '');
    setCapDraft(photo.caption ?? '');
    setEditingCap(false);
  }, [photo, journalDays]);

  const entriesForDay = React.useMemo(() => {
    if (!dayId) return [];
    return allEntries
      .filter((e) => e.dayId === dayId)
      .sort((a, b) => a.entryTimestamp.localeCompare(b.entryTimestamp));
  }, [allEntries, dayId]);

  const entryOptions = React.useMemo(() => {
    return allEntries
      .slice()
      .sort((a, b) => a.entryTimestamp.localeCompare(b.entryTimestamp))
      .map((e, i) => {
        const day = journalDays.find((d) => d.id === e.dayId);
        const dayLabel = day
          ? day.dayType === 'PreTrip'
            ? 'Pre-trip'
            : `Day ${day.dayNumber}`
          : 'Day';
        return { entry: e, label: `${dayLabel} · Entry ${i + 1}` };
      });
  }, [allEntries, journalDays]);

  const panelPhotos = React.useMemo(() => {
    if (panelView === 'all') {
      return [...allTripPhotos].sort(compareJournalPhotos);
    }
    if (panelView === 'day' && filterDayId) {
      return allTripPhotos.filter((p) => p.dayId === filterDayId).sort(compareJournalPhotos);
    }
    if (panelView === 'entry' && filterEntryId) {
      return photosForEntry(filterEntryId);
    }
    return [];
  }, [allTripPhotos, filterDayId, filterEntryId, panelView, photosForEntry]);

  const saveAssociation = (): void => {
    if (!photo || !dayId) return;
    assignPhotoToEntry(photo.id, dayId, entryId).catch(console.error);
  };

  if (sharedPreview || !trip) return null;

  return (
    <section className={styles.root} aria-label="Journal photos">
      <h2 className={styles.tripTitle}>{trip.title?.trim() || 'Trip'}</h2>

      {photo ? (
        <>
          <img className={styles.preview} src={photo.fileUrl} alt="" />
          <label className={styles.field}>
            <span>Caption</span>
            {editingCap ? (
              <div className={styles.captionEdit}>
                <input
                  className={styles.captionInput}
                  value={capDraft}
                  onChange={(e) => setCapDraft(e.target.value)}
                  aria-label="Photo caption"
                />
                <div className={styles.captionActions}>
                  <button
                    type="button"
                    className={styles.btn}
                    onClick={() => {
                      updatePhotoCaption(photo.id, capDraft.trim())
                        .then(() => setEditingCap(false))
                        .catch(console.error);
                    }}
                  >
                    Save
                  </button>
                  <button type="button" className={styles.btn} onClick={() => setEditingCap(false)}>
                    Cancel
                  </button>
                  <button
                    type="button"
                    className={`${styles.btn} ${styles.btnDanger}`}
                    onClick={() => {
                      void (async () => {
                        if (!(await confirmUserAction('Delete this caption?'))) return;
                        updatePhotoCaption(photo.id, '')
                          .then(() => {
                            setCapDraft('');
                            setEditingCap(false);
                          })
                          .catch(console.error);
                      })();
                    }}
                  >
                    Delete caption
                  </button>
                </div>
              </div>
            ) : (
              <div className={styles.captionView}>
                {photo.caption?.trim() ? <span>{photo.caption.trim()}</span> : null}
                <button type="button" className={styles.btn} onClick={() => setEditingCap(true)}>
                  {photo.caption?.trim() ? 'Edit caption' : 'Add caption'}
                </button>
              </div>
            )}
          </label>
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
            <button type="button" className={styles.btn} onClick={clearMediaSelection}>
              Show all photos
            </button>
            <button
              type="button"
              className={`${styles.btn} ${styles.btnDanger}`}
              onClick={() => {
                void (async () => {
                  if (!(await confirmUserAction('Delete this photo?'))) return;
                  deletePhoto(photo.id)
                    .then(() => clearMediaSelection())
                    .catch(console.error);
                })();
              }}
            >
              Delete photo
            </button>
          </div>
        </>
      ) : (
        <>
          <p className={styles.hint}>
            Browse all trip photos here, filter by day or entry, or click a photo in the feed to edit it. Drag photos onto a journal entry card to reassign.
          </p>
          <div className={styles.viewTabs} role="tablist" aria-label="Photo panel view">
            <button
              type="button"
              role="tab"
              aria-selected={panelView === 'all'}
              className={`${styles.viewTab} ${panelView === 'all' ? styles.viewTabActive : ''}`}
              onClick={() => setPanelView('all')}
            >
              All photos ({allTripPhotos.length})
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={panelView === 'day'}
              className={`${styles.viewTab} ${panelView === 'day' ? styles.viewTabActive : ''}`}
              onClick={() => setPanelView('day')}
            >
              By day
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={panelView === 'entry'}
              className={`${styles.viewTab} ${panelView === 'entry' ? styles.viewTabActive : ''}`}
              onClick={() => setPanelView('entry')}
            >
              By entry
            </button>
          </div>
          {panelView === 'day' ? (
            <label className={styles.field}>
              <span>Day</span>
              <select
                className={styles.select}
                value={filterDayId}
                onChange={(e) => setFilterDayId(e.target.value)}
                aria-label="Filter photos by day"
              >
                {journalDays.map((d) => (
                  <option key={d.id} value={d.id}>
                    {d.dayType === 'PreTrip' ? 'Pre-trip' : `Day ${d.dayNumber} — ${d.displayTitle}`}
                  </option>
                ))}
              </select>
            </label>
          ) : null}
          {panelView === 'entry' ? (
            <label className={styles.field}>
              <span>Journal entry</span>
              <select
                className={styles.select}
                value={filterEntryId}
                onChange={(e) => {
                  setFilterEntryId(e.target.value);
                  setSelectedEntryId(e.target.value || null);
                }}
                aria-label="Filter photos by journal entry"
              >
                {entryOptions.map(({ entry, label }) => (
                  <option key={entry.id} value={entry.id}>
                    {label}
                  </option>
                ))}
              </select>
            </label>
          ) : null}
          {panelPhotos.length ? (
            <>
              <p className={styles.hint}>Drag a photo onto a journal entry card to move it.</p>
              <JournalPhotoBoard
                photos={panelPhotos}
                selectedPhotoId={selectedPhotoId}
                onSelectPhoto={setSelectedPhotoId}
                draggable
                variant="compact"
              />
            </>
          ) : (
            <p className={styles.hint}>No photos in this view yet.</p>
          )}
        </>
      )}
    </section>
  );
};
