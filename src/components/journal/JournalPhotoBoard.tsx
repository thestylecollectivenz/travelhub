import * as React from 'react';
import type { JournalPhoto } from '../../models';
import { journalPhotoTileSizeAt } from '../../utils/journalPhotoBoardLayout';
import { setJournalPhotoDragData } from '../../utils/journalPhotoDrag';
import styles from './JournalPhotoBoard.module.css';

export interface JournalPhotoBoardProps {
  photos: JournalPhoto[];
  selectedPhotoId?: string | null;
  onSelectPhoto?: (photoId: string) => void;
  onOpenLightbox?: (url: string) => void;
  draggable?: boolean;
  renderFooter?: (photo: JournalPhoto) => React.ReactNode;
}

function tileClass(size: ReturnType<typeof journalPhotoTileSizeAt>): string {
  if (size === 'large') return `${styles.tile} ${styles.tileLarge}`;
  if (size === 'tall') return `${styles.tile} ${styles.tileTall}`;
  if (size === 'medium') return `${styles.tile} ${styles.tileMedium}`;
  return styles.tile;
}

export const JournalPhotoBoard: React.FC<JournalPhotoBoardProps> = ({
  photos,
  selectedPhotoId,
  onSelectPhoto,
  onOpenLightbox,
  draggable = false,
  renderFooter
}) => {
  if (!photos.length) return null;

  return (
    <div className={styles.board} role="list">
      {photos.map((photo, index) => {
        const selected = selectedPhotoId === photo.id;
        return (
          <figure
            key={photo.id}
            className={`${tileClass(journalPhotoTileSizeAt(index))} ${selected ? styles.tileSelected : ''}`}
            role="listitem"
            data-photo-id={photo.id}
            onClick={() => onSelectPhoto?.(photo.id)}
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
              onClick={(e) => {
                e.stopPropagation();
                onOpenLightbox?.(photo.fileUrl);
              }}
              aria-label={photo.caption?.trim() ? photo.caption : 'View photo'}
            >
              <img className={styles.thumb} src={photo.fileUrl} alt={photo.caption?.trim() ? photo.caption : ''} loading="lazy" />
            </button>
            {renderFooter ? <div className={styles.footer}>{renderFooter(photo)}</div> : null}
          </figure>
        );
      })}
    </div>
  );
};
