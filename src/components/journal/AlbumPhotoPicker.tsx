import * as React from 'react';
import type { JournalPhoto } from '../../models';
import { useJournal } from '../../context/JournalContext';
import { journalPhotoThumbUrl } from '../../utils/journalPhotoDisplayUrl';
import { photoObjectPositionStyle } from '../../utils/journalPhotoFocal';
import styles from './AlbumPhotoPicker.module.css';

export interface AlbumPhotoPickerProps {
  /** Photos that must not be offered (e.g. already attached to this entry). */
  excludePhotoIds?: string[];
  /** Parent is saving — block confirm. */
  busy?: boolean;
  confirmLabel?: string;
  onCancel: () => void;
  onConfirm: (photoIds: string[]) => void;
}

type AlbumScope = 'unlinked' | 'all';

export const AlbumPhotoPicker: React.FC<AlbumPhotoPickerProps> = ({
  excludePhotoIds = [],
  busy = false,
  confirmLabel = 'Add to entry',
  onCancel,
  onConfirm
}) => {
  const { allTripPhotos } = useJournal();
  const [scope, setScope] = React.useState<AlbumScope>('unlinked');
  const [selected, setSelected] = React.useState<string[]>([]);

  const excluded = React.useMemo(() => new Set(excludePhotoIds), [excludePhotoIds]);

  const candidates = React.useMemo(
    () => allTripPhotos.filter((p) => !excluded.has(p.id)),
    [allTripPhotos, excluded]
  );

  const unlinkedCount = React.useMemo(
    () => candidates.filter((p) => !(p.journalEntryId || '').trim()).length,
    [candidates]
  );

  const visible = React.useMemo(
    () => (scope === 'unlinked' ? candidates.filter((p) => !(p.journalEntryId || '').trim()) : candidates),
    [candidates, scope]
  );

  // Drop selections that scroll out of scope so the confirm count stays truthful.
  React.useEffect(() => {
    setSelected((prev) => prev.filter((id) => candidates.some((p) => p.id === id)));
  }, [candidates]);

  const toggle = (photo: JournalPhoto): void => {
    setSelected((prev) => (prev.indexOf(photo.id) >= 0 ? prev.filter((id) => id !== photo.id) : [...prev, photo.id]));
  };

  return (
    <div className={styles.root} role="group" aria-label="Pick photos from the trip album">
      <div className={styles.toolbar}>
        <div className={styles.segment} role="group" aria-label="Album photo scope">
          <button
            type="button"
            className={`${styles.segmentButton} ${scope === 'unlinked' ? styles.segmentActive : ''}`}
            onClick={() => setScope('unlinked')}
          >
            Unlinked ({unlinkedCount})
          </button>
          <button
            type="button"
            className={`${styles.segmentButton} ${scope === 'all' ? styles.segmentActive : ''}`}
            onClick={() => setScope('all')}
          >
            All ({candidates.length})
          </button>
        </div>
        <span className={styles.hint}>
          {selected.length ? `${selected.length} selected` : 'Tap photos to select'}
        </span>
      </div>

      {visible.length === 0 ? (
        <p className={styles.empty}>
          {scope === 'unlinked'
            ? 'No unlinked album photos. Switch to “All” to reuse a photo already in another entry.'
            : 'No album photos for this trip yet.'}
        </p>
      ) : (
        <div className={styles.grid} role="list">
          {visible.map((photo) => {
            const isSelected = selected.indexOf(photo.id) >= 0;
            return (
              <button
                key={photo.id}
                type="button"
                role="listitem"
                aria-pressed={isSelected}
                className={`${styles.tile} ${isSelected ? styles.tileSelected : ''}`}
                onClick={() => toggle(photo)}
              >
                <img
                  className={styles.thumb}
                  src={journalPhotoThumbUrl(photo.fileUrl, 240)}
                  alt={photo.caption?.trim() ? photo.caption : ''}
                  style={photoObjectPositionStyle(photo)}
                  loading="lazy"
                  decoding="async"
                  draggable={false}
                />
                {isSelected ? (
                  <span className={styles.check} aria-hidden>
                    ✓
                  </span>
                ) : null}
                {photo.caption?.trim() ? <span className={styles.caption}>{photo.caption}</span> : null}
              </button>
            );
          })}
        </div>
      )}

      <div className={styles.actions}>
        <button type="button" className={styles.button} onClick={onCancel} disabled={busy}>
          Cancel
        </button>
        <button
          type="button"
          className={`${styles.button} ${styles.primary}`}
          disabled={busy || selected.length === 0}
          onClick={() => onConfirm(selected)}
        >
          {busy ? 'Adding…' : `${confirmLabel}${selected.length ? ` (${selected.length})` : ''}`}
        </button>
      </div>
    </div>
  );
};
