import * as React from 'react';
import * as ReactDOM from 'react-dom';
import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import type { ItineraryEntry } from '../../models/ItineraryEntry';
import { useTripWorkspace } from '../../context/TripWorkspaceContext';
import { getCategorySlug } from '../../utils/categoryUtils';
import type { AccommodationTimelineLeg, TransportTimelineLeg } from '../../utils/itineraryDayEntries';
import { isLocationInfoEntry } from '../../utils/locationInfoEntry';
import { ItineraryCardEdit } from './ItineraryCardEdit';
import { ItineraryCardView } from './ItineraryCardView';
import { confirmUserAction } from '../../utils/confirmAction';
import { useTripPermissions } from '../../hooks/useTripPermissions';
import styles from './ItineraryCard.module.css';

export interface ItineraryCardProps {
  entry: ItineraryEntry;
  calendarDate: string;
  suppressCarryoverUi?: boolean;
  draggable?: boolean;
  hasTask?: boolean;
  linkedEntryTask?: import('../../utils/linkedEntryTask').LinkedEntryTask;
  linkedEntryTasks?: import('../../utils/linkedEntryTask').LinkedEntryTask[];
  hasCancellationDeadlineReminder?: boolean;
  /** Portals the edit form to document.body (Day Planner columns are too narrow). */
  useEditPortal?: boolean;
  /** When set, show a single outbound or return leg of a return transport entry. */
  transportLeg?: TransportTimelineLeg;
  /** When set, show arrive or depart leg of a one-day accommodation stay. */
  accommodationLeg?: AccommodationTimelineLeg;
  /** Unique id for drag-sort (defaults to entry.id; timeline legs use row keys). */
  sortableId?: string;
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
  linkedEntryTask,
  linkedEntryTasks,
  hasCancellationDeadlineReminder = false,
  useEditPortal = true,
  transportLeg,
  accommodationLeg,
  sortableId
}) => {
  const { editingCardId, setEditingCardId, focusedEntryId, updateEntry, deleteEntry, duplicateEntry } = useTripWorkspace();
  const { canEditItinerary } = useTripPermissions();
  const dragId = sortableId ?? entry.id;
  const allowDrag = draggable && canEditItinerary;
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: dragId,
    disabled: !allowDrag
  });

  const isEditing = editingCardId === entry.id;
  const isDraftNew = entry.id.startsWith('new-') && editingCardId === 'new';
  const [menuOpen, setMenuOpen] = React.useState(false);

  const showEdit = canEditItinerary && (isEditing || isDraftNew);
  const isFocused = focusedEntryId === entry.id && !showEdit;

  const handleSave = React.useCallback(
    (saved: ItineraryEntry) => {
      updateEntry(saved, { persistPending: true });
      setEditingCardId(null);
    },
    [updateEntry, setEditingCardId]
  );

  const handleCancel = React.useCallback(() => {
    setEditingCardId(null);
  }, [setEditingCardId]);

  const handleDelete = React.useCallback(() => {
    void (async () => {
      if (!(await confirmUserAction('Delete this itinerary item?'))) return;
      deleteEntry(entry.id);
      setEditingCardId(null);
    })();
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
      id={`itinerary-entry-${entry.id}`}
      className={`${styles.card} ${isLocationInfoEntry(entry) ? styles.cardLocationInfo : ''} ${showEdit ? styles.cardEditing : ''} ${isFocused ? styles.cardFocused : ''} ${menuOpen ? styles.cardMenuOpen : ''}`}
      data-category={categorySlug}
      data-entry-id={entry.id}
      style={dragStyle}
    >
      {allowDrag ? (
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
          transportLeg={transportLeg}
          accommodationLeg={accommodationLeg}
          hasTask={hasTask}
          linkedEntryTask={linkedEntryTask}
          linkedEntryTasks={linkedEntryTasks}
          hasCancellationDeadlineReminder={hasCancellationDeadlineReminder}
          readOnly={!canEditItinerary}
          onEdit={() => setEditingCardId(entry.id)}
          onDuplicate={() => duplicateEntry(entry.id)}
          onDelete={handleDelete}
          onMenuOpenChange={setMenuOpen}
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
