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
import type { EntryLink } from '../../models';
import { useAttachments } from '../../context/AttachmentsContext';
import { entryLinkSortableId, parseEntryLinkSortableId } from '../../utils/entryLinkSort';
import styles from './EntryLinksSortableList.module.css';

export interface EntryLinksSortableListProps {
  entryId: string;
  links: EntryLink[];
  className?: string;
  itemClassName?: string;
  children: (link: EntryLink, dragHandle: React.ReactNode) => React.ReactNode;
}

const LinkDragHandle = React.forwardRef<HTMLButtonElement, React.ButtonHTMLAttributes<HTMLButtonElement>>(
  function LinkDragHandle(props, ref) {
    return (
      <button
        ref={ref}
        type="button"
        className={styles.dragHandle}
        aria-label="Drag to reorder link"
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

interface SortableLinkItemProps {
  link: EntryLink;
  itemClassName?: string;
  children: (link: EntryLink, dragHandle: React.ReactNode) => React.ReactNode;
}

const SortableLinkItem: React.FC<SortableLinkItemProps> = ({ link, itemClassName, children }) => {
  const { attributes, listeners, setNodeRef, setActivatorNodeRef, transform, transition, isDragging } = useSortable({
    id: entryLinkSortableId(link.id)
  });
  const style: React.CSSProperties = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.55 : undefined
  };
  const dragHandle = <LinkDragHandle ref={setActivatorNodeRef} {...listeners} {...attributes} />;

  return (
    <div ref={setNodeRef} style={style} className={itemClassName}>
      {children(link, dragHandle)}
    </div>
  );
};

export const EntryLinksSortableList: React.FC<EntryLinksSortableListProps> = ({
  entryId,
  links,
  className,
  itemClassName,
  children
}) => {
  const { reorderEntryLinks } = useAttachments();
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  );

  const sortableIds = React.useMemo(() => links.map((l) => entryLinkSortableId(l.id)), [links]);

  const handleDragEnd = React.useCallback(
    (event: DragEndEvent) => {
      const { active, over } = event;
      if (!over || active.id === over.id) return;
      const activeId = parseEntryLinkSortableId(active.id);
      const overId = parseEntryLinkSortableId(over.id);
      if (!activeId || !overId) return;
      const oldIndex = links.findIndex((l) => l.id === activeId);
      const newIndex = links.findIndex((l) => l.id === overId);
      if (oldIndex < 0 || newIndex < 0 || oldIndex === newIndex) return;
      const next = arrayMove(
        links.map((l) => l.id),
        oldIndex,
        newIndex
      );
      reorderEntryLinks(entryId, next);
    },
    [entryId, links, reorderEntryLinks]
  );

  if (links.length < 2) {
    return (
      <div className={className}>
        {links.map((link) => (
          <div key={link.id} className={itemClassName}>
            {children(link, null)}
          </div>
        ))}
      </div>
    );
  }

  return (
    <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
      <SortableContext items={sortableIds} strategy={verticalListSortingStrategy}>
        <div className={className}>
          {links.map((link) => (
            <SortableLinkItem key={link.id} link={link} itemClassName={itemClassName}>
              {children}
            </SortableLinkItem>
          ))}
        </div>
      </SortableContext>
    </DndContext>
  );
};
