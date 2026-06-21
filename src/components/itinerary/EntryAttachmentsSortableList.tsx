import * as React from 'react';
import {
  DndContext,
  KeyboardSensor,
  PointerSensor,
  closestCenter,
  useSensor,
  useSensors,
  type DragEndEvent
} from '@dnd-kit/core';
import {
  SortableContext,
  arrayMove,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import type { EntryDocument, EntryLink } from '../../models';
import { useAttachments } from '../../context/AttachmentsContext';
import {
  entryAttachmentSortableId,
  mergeEntryAttachments,
  parseEntryAttachmentSortableId,
  type EntryAttachmentRow
} from '../../utils/entryAttachmentSort';
import styles from './EntryLinksSortableList.module.css';

export interface EntryAttachmentsSortableListProps {
  entryId: string;
  documents: EntryDocument[];
  links: EntryLink[];
  className?: string;
  itemClassName?: string;
  children: (row: EntryAttachmentRow, dragHandle: React.ReactNode) => React.ReactNode;
}

const AttachmentDragHandle = React.forwardRef<HTMLButtonElement, React.ButtonHTMLAttributes<HTMLButtonElement>>(
  function AttachmentDragHandle(props, ref) {
    return (
      <button
        ref={ref}
        type="button"
        className={styles.dragHandle}
        aria-label="Drag to reorder"
        title="Drag to reorder"
        {...props}
      >
        <svg width={12} height={12} viewBox="0 0 16 16" aria-hidden>
          <circle cx="5" cy="3" r="1" fill="currentColor" />
          <circle cx="11" cy="3" r="1" fill="currentColor" />
          <circle cx="5" cy="8" r="1" fill="currentColor" />
          <circle cx="11" cy="8" r="1" fill="currentColor" />
          <circle cx="5" cy="13" r="1" fill="currentColor" />
          <circle cx="11" cy="13" r="1" fill="currentColor" />
        </svg>
      </button>
    );
  }
);

interface SortableAttachmentItemProps {
  row: EntryAttachmentRow;
  itemClassName?: string;
  children: (row: EntryAttachmentRow, dragHandle: React.ReactNode) => React.ReactNode;
}

const SortableAttachmentItem: React.FC<SortableAttachmentItemProps> = ({ row, itemClassName, children }) => {
  const sortId = entryAttachmentSortableId({
    kind: row.kind,
    id: row.kind === 'doc' ? row.item.id : row.item.id
  });
  const { attributes, listeners, setNodeRef, setActivatorNodeRef, transform, transition, isDragging } = useSortable({
    id: sortId
  });
  const style: React.CSSProperties = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.55 : undefined
  };
  const dragHandle = <AttachmentDragHandle ref={setActivatorNodeRef} {...listeners} {...attributes} />;

  return (
    <div ref={setNodeRef} style={style} className={itemClassName}>
      {children(row, dragHandle)}
    </div>
  );
};

export const EntryAttachmentsSortableList: React.FC<EntryAttachmentsSortableListProps> = ({
  entryId,
  documents,
  links,
  className,
  itemClassName,
  children
}) => {
  const { reorderEntryAttachments } = useAttachments();
  const rows = React.useMemo(() => mergeEntryAttachments(documents, links), [documents, links]);
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  );

  const sortableIds = React.useMemo(
    () =>
      rows.map((row) =>
        entryAttachmentSortableId({ kind: row.kind, id: row.item.id })
      ),
    [rows]
  );

  const handleDragEnd = React.useCallback(
    (event: DragEndEvent) => {
      const { active, over } = event;
      if (!over || active.id === over.id) return;
      const activeItem = parseEntryAttachmentSortableId(active.id);
      const overItem = parseEntryAttachmentSortableId(over.id);
      if (!activeItem || !overItem) return;
      const order = rows.map((row) => ({ kind: row.kind, id: row.item.id }));
      const oldIndex = order.findIndex((item) => item.kind === activeItem.kind && item.id === activeItem.id);
      const newIndex = order.findIndex((item) => item.kind === overItem.kind && item.id === overItem.id);
      if (oldIndex < 0 || newIndex < 0 || oldIndex === newIndex) return;
      reorderEntryAttachments(entryId, arrayMove(order, oldIndex, newIndex));
    },
    [entryId, rows, reorderEntryAttachments]
  );

  if (rows.length < 2) {
    return (
      <div className={className}>
        {rows.map((row) => (
          <div key={`${row.kind}:${row.item.id}`} className={itemClassName}>
            {children(row, null)}
          </div>
        ))}
      </div>
    );
  }

  return (
    <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
      <SortableContext items={sortableIds} strategy={verticalListSortingStrategy}>
        <div className={className}>
          {rows.map((row) => (
            <SortableAttachmentItem key={`${row.kind}:${row.item.id}`} row={row} itemClassName={itemClassName}>
              {children}
            </SortableAttachmentItem>
          ))}
        </div>
      </SortableContext>
    </DndContext>
  );
};
