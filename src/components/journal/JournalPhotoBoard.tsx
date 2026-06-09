import * as React from 'react';
import {
  DndContext,
  PointerSensor,
  TouchSensor,
  closestCenter,
  useSensor,
  useSensors,
  type DragEndEvent
} from '@dnd-kit/core';
import { SortableContext, rectSortingStrategy, useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import type { JournalPhoto } from '../../models';
import { setJournalPhotoDragData } from '../../utils/journalPhotoDrag';
import { fromPhotoSortId, toPhotoSortId } from '../../utils/journalPhotoSortId';
import styles from './JournalPhotoBoard.module.css';

export interface JournalPhotoBoardProps {
  photos: JournalPhoto[];
  selectedPhotoId?: string | null;
  onSelectPhoto?: (photoId: string) => void;
  onOpenLightbox?: (url: string) => void;
  /** HTML5 drag handle for moving photos between journal entries. */
  draggable?: boolean;
  /** Drag-and-drop reorder within one entry (dnd-kit). */
  sortable?: boolean;
  onReorderPhoto?: (photoId: string, beforePhotoId: string) => void;
  renderFooter?: (photo: JournalPhoto) => React.ReactNode;
  /** When true, footer is omitted if renderFooter returns null. */
  footerOptional?: boolean;
  /** Compact draggable thumbnails (e.g. right pane). */
  variant?: 'board' | 'compact';
}

interface PhotoTileProps {
  photo: JournalPhoto;
  selected: boolean;
  draggable: boolean;
  sortable: boolean;
  sortableHandleProps?: React.HTMLAttributes<HTMLSpanElement>;
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
  draggable,
  sortable,
  sortableHandleProps,
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
      {sortable ? (
        <span
          className={styles.sortHandle}
          aria-label="Drag to reorder photo"
          title="Drag to reorder"
          {...sortableHandleProps}
        >
          ⇅
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
      {showFooter && footer ? (
        footerOptional ? (
          <div onClick={(e) => e.stopPropagation()}>{footer}</div>
        ) : (
          <div className={styles.footer} onClick={(e) => e.stopPropagation()}>
            {footer}
          </div>
        )
      ) : null}
    </figure>
  );
}

function SortablePhotoTile(
  props: Omit<PhotoTileProps, 'sortableRef' | 'sortableStyle' | 'sortableHandleProps'> & { sortableId: string }
): React.ReactElement {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: props.sortableId });
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
      sortableHandleProps={{ ...attributes, ...listeners }}
    />
  );
}

export const JournalPhotoBoard: React.FC<JournalPhotoBoardProps> = ({
  photos,
  selectedPhotoId,
  onSelectPhoto,
  onOpenLightbox,
  draggable = false,
  sortable = false,
  onReorderPhoto,
  renderFooter,
  footerOptional = false,
  variant = 'board'
}) => {
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 120, tolerance: 6 } })
  );

  const onDragEnd = React.useCallback(
    (event: DragEndEvent): void => {
      const { active, over } = event;
      if (!over || active.id === over.id) return;
      onReorderPhoto?.(fromPhotoSortId(String(active.id)), fromPhotoSortId(String(over.id)));
    },
    [onReorderPhoto]
  );

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
                draggable={draggable}
                onDragStart={
                  draggable
                    ? (e) => {
                        setJournalPhotoDragData(e.dataTransfer, photo.id);
                      }
                    : undefined
                }
              />
            </button>
          </div>
        ))}
      </div>
    );
  }

  const tiles = photos.map((photo) => {
    const selected = selectedPhotoId === photo.id;
    const common = {
      photo,
      selected,
      draggable,
      sortable,
      onSelectPhoto,
      onOpenLightbox,
      renderFooter,
      footerOptional
    };
    if (sortable) {
      return <SortablePhotoTile key={photo.id} sortableId={toPhotoSortId(photo.id)} {...common} />;
    }
    return <PhotoTile key={photo.id} {...common} />;
  });

  if (sortable && onReorderPhoto) {
    return (
      <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={onDragEnd}>
        <SortableContext items={photos.map((p) => toPhotoSortId(p.id))} strategy={rectSortingStrategy}>
          <div className={styles.board} role="list">
            {tiles}
          </div>
        </SortableContext>
      </DndContext>
    );
  }

  return (
    <div className={styles.board} role="list">
      {tiles}
    </div>
  );
};
