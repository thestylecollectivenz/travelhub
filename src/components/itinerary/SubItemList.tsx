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
import type { ItinerarySubItem } from '../../models/ItineraryEntry';
import { minutesFromTimeStart } from '../../utils/itineraryTimeUtils';
import { useTripWorkspace } from '../../context/TripWorkspaceContext';
import { SubItem } from './SubItem';
import styles from './SubItemList.module.css';

export interface SubItemListProps {
  subItems: ItinerarySubItem[];
  entryId: string;
}

function sortedSubItems(subItems: ItinerarySubItem[]): ItinerarySubItem[] {
  return [...subItems].sort((a, b) => {
    const sortDiff = (a.sortOrder ?? 0) - (b.sortOrder ?? 0);
    if (sortDiff !== 0) return sortDiff;
    const am = minutesFromTimeStart(a.startTime || '');
    const bm = minutesFromTimeStart(b.startTime || '');
    if (am === undefined && bm === undefined) return 0;
    if (am === undefined) return 1;
    if (bm === undefined) return -1;
    return am - bm;
  });
}

function sortableSubItemId(id: string): string {
  return `subitem:${id}`;
}

function parseSortableSubItemId(raw: string | number): string | null {
  const text = String(raw);
  return text.startsWith('subitem:') ? text.slice(8) : null;
}

const SubItemDragHandle = React.forwardRef<HTMLButtonElement, React.ButtonHTMLAttributes<HTMLButtonElement>>(
  function SubItemDragHandle(props, ref) {
    return (
      <button
        ref={ref}
        type="button"
        className={styles.dragHandle}
        aria-label="Drag to reorder option"
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

const SortableSubItemRow: React.FC<{ item: ItinerarySubItem; entryId: string }> = ({ item, entryId }) => {
  const { attributes, listeners, setNodeRef, setActivatorNodeRef, transform, transition, isDragging } = useSortable({
    id: sortableSubItemId(item.id)
  });
  const style: React.CSSProperties = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.55 : undefined
  };
  const dragHandle = <SubItemDragHandle ref={setActivatorNodeRef} {...listeners} {...attributes} />;

  return (
    <div ref={setNodeRef} style={style}>
      <SubItem item={item} parentEntryId={entryId} dragHandle={dragHandle} />
    </div>
  );
};

export const SubItemList: React.FC<SubItemListProps> = ({ subItems, entryId }) => {
  const { reorderSubItems } = useTripWorkspace();
  const items = React.useMemo(() => sortedSubItems(subItems), [subItems]);
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  );
  const sortableIds = React.useMemo(() => items.map((s) => sortableSubItemId(s.id)), [items]);

  const onDragEnd = React.useCallback(
    (event: DragEndEvent) => {
      const { active, over } = event;
      if (!over || active.id === over.id) return;
      const activeId = parseSortableSubItemId(active.id);
      const overId = parseSortableSubItemId(over.id);
      if (!activeId || !overId) return;
      const oldIndex = items.findIndex((s) => s.id === activeId);
      const newIndex = items.findIndex((s) => s.id === overId);
      if (oldIndex < 0 || newIndex < 0 || oldIndex === newIndex) return;
      const next = arrayMove(
        items.map((s) => s.id),
        oldIndex,
        newIndex
      );
      reorderSubItems(entryId, next);
    },
    [entryId, reorderSubItems, items]
  );

  return (
    <div className={styles.container}>
      <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={onDragEnd}>
        <SortableContext items={sortableIds} strategy={verticalListSortingStrategy}>
          <div className={styles.items}>
            {items.map((item) => (
              <SortableSubItemRow key={item.id} item={item} entryId={entryId} />
            ))}
          </div>
        </SortableContext>
      </DndContext>
    </div>
  );
};
