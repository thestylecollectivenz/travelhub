import * as React from 'react';
import type { JournalPhoto } from '../../models';
import { setJournalPhotoDragData } from '../../utils/journalPhotoDrag';
import styles from './JournalPhotoBoard.module.css';

export interface JournalPhotoBoardProps {
  photos: JournalPhoto[];
  selectedPhotoId?: string | null;
  onSelectPhoto?: (photoId: string) => void;
  onOpenLightbox?: (url: string) => void;
  draggable?: boolean;
  renderFooter?: (photo: JournalPhoto) => React.ReactNode;
  /** Compact draggable thumbnails (e.g. right pane). */
  variant?: 'board' | 'compact';
}

export const JournalPhotoBoard: React.FC<JournalPhotoBoardProps> = ({
  photos,
  selectedPhotoId,
  onSelectPhoto,
  onOpenLightbox,
  draggable = false,
  renderFooter,
  variant = 'board'
}) => {
  if (!photos.length) return null;

  if (variant === 'compact') {
    return (
      <div className={styles.compactList} role="list">
        {photos.map((photo) => (
          <div key={photo.id} className={styles.compactTile} role="listitem">
            <img
              className={styles.compactThumb}
              src={photo.fileUrl}
              alt={photo.caption?.trim() ? photo.caption : ''}
              draggable={draggable}
              onDragStart={
                draggable
                  ? (e) => {
                      setJournalPhotoDragData(e.dataTransfer, photo.id);
                    }
                  : undefined
              }
              onClick={() => onSelectPhoto?.(photo.id)}
            />
          </div>
        ))}
      </div>
    );
  }

  return (
    <div className={styles.board} role="list">
      {photos.map((photo) => {
        const selected = selectedPhotoId === photo.id;
        return (
          <figure
            key={photo.id}
            className={`${styles.tile} ${selected ? styles.tileSelected : ''}`}
            role="listitem"
            data-photo-id={photo.id}
          >
            {draggable ? (
              <span
                className={styles.dragHandle}
                draggable
                onDragStart={(e) => {
                  setJournalPhotoDragData(e.dataTransfer, photo.id);
                  e.stopPropagation();
                }}
                aria-label="Drag photo to another journal entry"
                title="Drag to a journal entry"
              >
                ⋮⋮
              </span>
            ) : null}
            <button
              type="button"
              className={styles.thumbBtn}
              onClick={() => onOpenLightbox?.(photo.fileUrl)}
              aria-label={photo.caption?.trim() ? photo.caption : 'View photo'}
            >
              <img className={styles.thumb} src={photo.fileUrl} alt={photo.caption?.trim() ? photo.caption : ''} loading="lazy" />
            </button>
            {renderFooter ? (
              <div className={styles.footer} onClick={(e) => e.stopPropagation()}>
                {renderFooter(photo)}
              </div>
            ) : null}
          </figure>
        );
      })}
    </div>
  );
};
