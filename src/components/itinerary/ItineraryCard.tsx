import * as React from 'react';
import type { ItineraryEntry } from '../../models/ItineraryEntry';
import { useTripWorkspace } from '../../context/TripWorkspaceContext';
import { ItineraryCardEdit } from './ItineraryCardEdit';
import { ItineraryCardView } from './ItineraryCardView';
import styles from './ItineraryCard.module.css';

export interface ItineraryCardProps {
  entry: ItineraryEntry;
  categoryColor: string;
  calendarDate: string;
}

export const ItineraryCard: React.FC<ItineraryCardProps> = ({ entry, categoryColor, calendarDate }) => {
  const { editingCardId, setEditingCardId, updateEntry, deleteEntry, duplicateEntry } = useTripWorkspace();

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

  return (
    <div
      className={`${styles.card} ${showEdit ? styles.cardEditing : ''}`}
      style={{ ['--card-node-category' as string]: categoryColor } as React.CSSProperties}
    >
      {showEdit ? (
        <ItineraryCardEdit
          key={entry.id}
          entry={entry}
          calendarDate={calendarDate}
          onSave={handleSave}
          onCancel={handleCancel}
          onDelete={handleDelete}
        />
      ) : (
        <ItineraryCardView
          entry={entry}
          onEdit={() => setEditingCardId(entry.id)}
          onDuplicate={() => duplicateEntry(entry.id)}
          onDelete={() => deleteEntry(entry.id)}
        />
      )}
    </div>
  );
};
