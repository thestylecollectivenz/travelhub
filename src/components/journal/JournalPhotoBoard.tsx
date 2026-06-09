import * as React from 'react';
import { SortableContext, rectSortingStrategy, useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import type { JournalPhoto } from '../../models';
import { toPhotoSortId } from '../../utils/journalPhotoSortId';
import styles from './JournalPhotoBoard.module.css';

export interface JournalPhotoBoardProps {
  photos: JournalPhoto[];
  selectedPhotoId?: string | null;
  onSelectPhoto?: (photoId: string) => void;
  onOpenLightbox?: (url: string) => void;
  /** Show drag handle and enable reorder / cross-entry move via parent DndContext. */
  sortable?: boolean;
  /** Journal entry id when sortable — scopes drag data in the parent DndContext. */
  sortableEntryId?: string;
  renderFooter?: (photo: JournalPhoto) => React.ReactNode;
  /** When true, footer is omitted if renderFooter returns null. */
  footerOptional?: boolean;
  /** Compact thumbnails (e.g. right pane). */
  variant?: 'board' | 'compact';
}

interface PhotoTileProps {
  photo: JournalPhoto;
  selected: boolean;
  sortable: boolean;
  dragHandleProps?: React.HTMLAttributes<HTMLButtonElement>;
  sortableStyle?: React.CSSProperties;
  sortableRef?: (node: HTMLElement | null) => void;
  onSelectPhoto?: (photoId: string) => void;
  onOpenLightbox?: (url: string) => void;
  renderFooter?: (photo: JournalPhoto) => React.ReactNode;
  footerOptional?: boolean;
}

function PhotoTile({
  photo,
  selected,
  sortable,
  dragHandleProps,
  sortableStyle,
  sortableRef,
  onSelectPhoto,
  onOpenLightbox,
  renderFooter,
  footerOptional
}: PhotoTileProps): React.ReactElement {
  const footer = renderFooter ? renderFooter(photo) : null;
  const showFooter = footerOptional ? Boolean(footer) : Boolean(renderFooter);

  return (
    <figure
      ref={sortableRef}
      style={sortableStyle}
      className={`${styles.tile} ${selected ? styles.tileSelected : ''}`}
      role="listitem"
      data-photo-id={photo.id}
    >
      {sortable && dragHandleProps ? (
        <button
          type="button"
          className={styles.dragHandle}
          aria-label="Drag to reorder or move photo"
          title="Drag to reorder or move"
          {...dragHandleProps}
        >
          ⋮⋮
        </button>
      ) : null}
      <button
        type="button"
        className={styles.thumbBtn}
        onClick={() => onOpenLightbox?.(photo.fileUrl)}
        aria-label={photo.caption?.trim() ? photo.caption : 'View photo'}
      >
        <img
          className={styles.thumb}
          src={photo.fileUrl}
          alt={photo.caption?.trim() ? photo.caption : ''}
          loading="lazy"
          draggable={false}
        />
      </button>
      {showFooter && footer ? (
        footerOptional ? (
          <div onClick={(e) => e.stopPropagation()} onPointerDown={(e) => e.stopPropagation()}>
            {footer}
          </div>
        ) : (
          <div className={styles.footer} onClick={(e) => e.stopPropagation()} onPointerDown={(e) => e.stopPropagation()}>
            {footer}
          </div>
        )
      ) : null}
    </figure>
  );
}

function SortablePhotoTile(
  props: Omit<PhotoTileProps, 'sortableRef' | 'sortableStyle' | 'dragHandleProps'> & {
    sortableId: string;
    sortableEntryId: string;
  }
): React.ReactElement {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: props.sortableId,
    data: { type: 'photo', entryId: props.sortableEntryId }
  });
  const style: React.CSSProperties = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.55 : 1,
    zIndex: isDragging ? 2 : undefined
  };
  return (
    <PhotoTile
      {...props}
      sortableRef={setNodeRef}
      sortableStyle={style}
      dragHandleProps={{ ...attributes, ...listeners }}
    />
  );
}

export const JournalPhotoBoard: React.FC<JournalPhotoBoardProps> = ({
  photos,
  selectedPhotoId,
  onSelectPhoto,
  onOpenLightbox,
  sortable = false,
  sortableEntryId,
  renderFooter,
  footerOptional = false,
  variant = 'board'
}) => {
  if (!photos.length) return null;

  if (variant === 'compact') {
    return (
      <div className={styles.compactList} role="list">
        {photos.map((photo) => (
          <div key={photo.id} className={styles.compactTile} role="listitem">
            <button
              type="button"
              className={styles.compactThumbBtn}
              onClick={() => onSelectPhoto?.(photo.id)}
              aria-label={photo.caption?.trim() ? photo.caption : 'Select photo'}
            >
              <img
                className={styles.compactThumb}
                src={photo.fileUrl}
                alt={photo.caption?.trim() ? photo.caption : ''}
                draggable={false}
              />
            </button>
          </div>
        ))}
      </div>
    );
  }

  const entryId = sortableEntryId ?? photos[0]?.journalEntryId?.trim() ?? '';

  const tiles = photos.map((photo) => {
    const selected = selectedPhotoId === photo.id;
    const common = {
      photo,
      selected,
      sortable,
      onSelectPhoto,
      onOpenLightbox,
      renderFooter,
      footerOptional
    };
    if (sortable && entryId) {
      return <SortablePhotoTile key={photo.id} sortableId={toPhotoSortId(photo.id)} {...common} sortableEntryId={entryId} />;
    }
    return <PhotoTile key={photo.id} {...common} />;
  });

  if (sortable && entryId) {
    return (
      <SortableContext items={photos.map((p) => toPhotoSortId(p.id))} strategy={rectSortingStrategy}>
        <div className={styles.board} role="list">
          {tiles}
        </div>
      </SortableContext>
    );
  }

  return (
    <div className={styles.board} role="list">
      {tiles}
    </div>
  );
};
