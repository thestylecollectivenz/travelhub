import * as React from 'react';
import type { JournalPhoto } from '../../models';
import { useJournal } from '../../context/JournalContext';
import { confirmUserAction } from '../../utils/confirmAction';
import boardStyles from './JournalPhotoBoard.module.css';
import styles from './JournalPhotoCaptionFooter.module.css';

export interface JournalPhotoCaptionFooterProps {
  photo: JournalPhoto;
  canModerate: boolean;
}

export function journalPhotoFooterClass(hasCaption: boolean, editingCap: boolean): string {
  return hasCaption || editingCap
    ? styles.photoFooterBar
    : `${styles.photoFooterBar} ${boardStyles.photoFooterOnHover}`;
}

export const JournalPhotoCaptionFooter: React.FC<JournalPhotoCaptionFooterProps> = ({ photo, canModerate }) => {
  const { updatePhotoCaption, deletePhoto } = useJournal();
  const [editingCap, setEditingCap] = React.useState(false);
  const [capDraft, setCapDraft] = React.useState(photo.caption);

  React.useEffect(() => {
    setCapDraft(photo.caption);
  }, [photo.caption]);

  const hasCaption = Boolean(photo.caption?.trim());

  if (!canModerate) {
    return hasCaption ? <p className={styles.photoCaptionReadonly}>{photo.caption.trim()}</p> : null;
  }

  return (
    <div className={journalPhotoFooterClass(hasCaption, editingCap)}>
      {editingCap ? (
        <>
          <input
            className={styles.photoCaptionInput}
            value={capDraft}
            onChange={(e) => setCapDraft(e.target.value)}
            placeholder="Write a caption…"
            aria-label="Caption"
            autoFocus
          />
          <div className={styles.photoCaptionEditActions}>
            <button
              type="button"
              className={styles.photoFooterBtn}
              onClick={() => {
                updatePhotoCaption(photo.id, capDraft.trim())
                  .then(() => setEditingCap(false))
                  .catch(console.error);
              }}
            >
              Save
            </button>
            {hasCaption ? (
              <button
                type="button"
                className={styles.photoFooterBtn}
                onClick={() => {
                  void (async () => {
                    if (!(await confirmUserAction('Delete this photo caption?'))) return;
                    updatePhotoCaption(photo.id, '')
                      .then(() => {
                        setCapDraft('');
                        setEditingCap(false);
                      })
                      .catch(console.error);
                  })();
                }}
              >
                Remove caption
              </button>
            ) : null}
            <button
              type="button"
              className={styles.photoFooterBtn}
              onClick={() => {
                setCapDraft(photo.caption);
                setEditingCap(false);
              }}
            >
              Cancel
            </button>
          </div>
        </>
      ) : hasCaption ? (
        <div className={styles.photoCaptionView}>
          <span className={styles.photoCaption}>{photo.caption.trim()}</span>
          <button type="button" className={styles.photoFooterBtn} onClick={() => setEditingCap(true)}>
            Edit caption
          </button>
        </div>
      ) : (
        <button type="button" className={styles.photoFooterBtn} onClick={() => setEditingCap(true)}>
          Add caption
        </button>
      )}
      <button
        type="button"
        className={`${styles.photoFooterBtn} ${styles.photoDeleteBtn}`}
        onClick={() => {
          void (async () => {
            if (!(await confirmUserAction('Delete this photo?'))) return;
            deletePhoto(photo.id).catch(console.error);
          })();
        }}
      >
        Delete photo
      </button>
    </div>
  );
};
