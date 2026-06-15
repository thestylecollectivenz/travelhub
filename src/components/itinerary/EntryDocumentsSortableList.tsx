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
import type { EntryDocument } from '../../models';
import { useAttachments } from '../../context/AttachmentsContext';
import { entryDocumentSortableId, parseEntryDocumentSortableId } from '../../utils/entryDocumentSort';
import styles from './EntryLinksSortableList.module.css';

export interface EntryDocumentsSortableListProps {
  entryId: string;
  documents: EntryDocument[];
  className?: string;
  itemClassName?: string;
  children: (doc: EntryDocument, dragHandle: React.ReactNode) => React.ReactNode;
}

const DocDragHandle = React.forwardRef<HTMLButtonElement, React.ButtonHTMLAttributes<HTMLButtonElement>>(
  function DocDragHandle(props, ref) {
    return (
      <button
        ref={ref}
        type="button"
        className={styles.dragHandle}
        aria-label="Drag to reorder document"
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

interface SortableDocItemProps {
  doc: EntryDocument;
  itemClassName?: string;
  children: (doc: EntryDocument, dragHandle: React.ReactNode) => React.ReactNode;
}

const SortableDocItem: React.FC<SortableDocItemProps> = ({ doc, itemClassName, children }) => {
  const { attributes, listeners, setNodeRef, setActivatorNodeRef, transform, transition, isDragging } = useSortable({
    id: entryDocumentSortableId(doc.id)
  });
  const style: React.CSSProperties = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.55 : undefined
  };
  const dragHandle = <DocDragHandle ref={setActivatorNodeRef} {...listeners} {...attributes} />;

  return (
    <div ref={setNodeRef} style={style} className={itemClassName}>
      {children(doc, dragHandle)}
    </div>
  );
};

export const EntryDocumentsSortableList: React.FC<EntryDocumentsSortableListProps> = ({
  entryId,
  documents,
  className,
  itemClassName,
  children
}) => {
  const { reorderEntryDocuments } = useAttachments();
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  );

  const sortableIds = React.useMemo(() => documents.map((d) => entryDocumentSortableId(d.id)), [documents]);

  const handleDragEnd = React.useCallback(
    (event: DragEndEvent) => {
      const { active, over } = event;
      if (!over || active.id === over.id) return;
      const activeId = parseEntryDocumentSortableId(active.id);
      const overId = parseEntryDocumentSortableId(over.id);
      if (!activeId || !overId) return;
      const oldIndex = documents.findIndex((d) => d.id === activeId);
      const newIndex = documents.findIndex((d) => d.id === overId);
      if (oldIndex < 0 || newIndex < 0 || oldIndex === newIndex) return;
      const next = arrayMove(
        documents.map((d) => d.id),
        oldIndex,
        newIndex
      );
      reorderEntryDocuments(entryId, next);
    },
    [entryId, documents, reorderEntryDocuments]
  );

  if (documents.length < 2) {
    return (
      <div className={className}>
        {documents.map((doc) => (
          <div key={doc.id} className={itemClassName}>
            {children(doc, null)}
          </div>
        ))}
      </div>
    );
  }

  return (
    <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
      <SortableContext items={sortableIds} strategy={verticalListSortingStrategy}>
        <div className={className}>
          {documents.map((doc) => (
            <SortableDocItem key={doc.id} doc={doc} itemClassName={itemClassName}>
              {children}
            </SortableDocItem>
          ))}
        </div>
      </SortableContext>
    </DndContext>
  );
};
