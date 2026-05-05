import * as React from 'react';
import * as ReactDOM from 'react-dom';
import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import type { ItineraryEntry } from '../../models/ItineraryEntry';
import { useTripWorkspace } from '../../context/TripWorkspaceContext';
import { getCategorySlug } from '../../utils/categoryUtils';
import { ItineraryCardEdit } from './ItineraryCardEdit';
import { ItineraryCardView } from './ItineraryCardView';
import styles from './ItineraryCard.module.css';

export interface ItineraryCardProps {
  entry: ItineraryEntry;
  calendarDate: string;
  suppressCarryoverUi?: boolean;
  draggable?: boolean;
  hasTask?: boolean;
  hasCancellationDeadlineReminder?: boolean;
  /** Portals the edit form to document.body (Day Planner columns are too narrow). */
  useEditPortal?: boolean;
}

function GripIcon(): React.ReactElement {
  return (
    <svg width={16} height={16} viewBox="0 0 16 16" aria-hidden>
      <circle cx="5" cy="3" r="1" />
      <circle cx="11" cy="3" r="1" />
      <circle cx="5" cy="8" r="1" />
      <circle cx="11" cy="8" r="1" />
      <circle cx="5" cy="13" r="1" />
      <circle cx="11" cy="13" r="1" />
    </svg>
  );
}

export const ItineraryCard: React.FC<ItineraryCardProps> = ({
  entry,
  calendarDate,
  suppressCarryoverUi,
  draggable = true,
  hasTask = false,
  hasCancellationDeadlineReminder = false,
  useEditPortal = false
}) => {
  const { editingCardId, setEditingCardId, updateEntry, deleteEntry, duplicateEntry } = useTripWorkspace();
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: entry.id,
    disabled: !draggable
  });

  const isEditing = editingCardId === entry.id;
  const isDraftNew = entry.id.startsWith('new-') && editingCardId === 'new';

  const showEdit = isEditing || isDraftNew;

  const handleSave = React.useCallback(
    (saved: ItineraryEntry) => {
      updateEntry(saved);
      setEditingCardId(null);
    },
    [updateEntry, setEditingCardId]
  );

  const handleCancel = React.useCallback(() => {
    setEditingCardId(null);
  }, [setEditingCardId]);

  const handleDelete = React.useCallback(() => {
    deleteEntry(entry.id);
    setEditingCardId(null);
  }, [deleteEntry, entry.id, setEditingCardId]);

  const editForm = showEdit ? (
    <ItineraryCardEdit
      key={entry.id}
      entry={entry}
      calendarDate={calendarDate}
      onSave={handleSave}
      onCancel={handleCancel}
      onDelete={handleDelete}
    />
  ) : null;

  const categorySlug = getCategorySlug(entry.category);

  const dragStyle: React.CSSProperties = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
    zIndex: isDragging ? 999 : undefined
  };

  return (
    <div
      ref={setNodeRef}
      className={`${styles.card} ${showEdit ? styles.cardEditing : ''}`}
      data-category={categorySlug}
      data-entry-id={entry.id}
      style={dragStyle}
    >
      {draggable ? (
        <button
          type="button"
          className={`${styles.dragHandle} ${isDragging ? styles.dragging : ''}`}
          aria-label="Drag itinerary item"
          {...attributes}
          {...listeners}
        >
          <GripIcon />
        </button>
      ) : null}
      {showEdit && useEditPortal && typeof document !== 'undefined'
        ? null
        : showEdit
          ? editForm
          : (
        <ItineraryCardView
          entry={entry}
          calendarDate={calendarDate}
          suppressCarryoverUi={suppressCarryoverUi}
          hasTask={hasTask}
          hasCancellationDeadlineReminder={hasCancellationDeadlineReminder}
          onEdit={() => setEditingCardId(entry.id)}
          onDuplicate={() => duplicateEntry(entry.id)}
          onDelete={() => deleteEntry(entry.id)}
        />
      )}
      {showEdit && useEditPortal && typeof document !== 'undefined'
        ? ReactDOM.createPortal(
            <div className={styles.portalEditRoot} role="presentation">
              <div className={styles.portalEditInner}>{editForm}</div>
            </div>,
            document.body
          )
        : null}
    </div>
  );
};
