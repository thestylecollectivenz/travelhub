import * as React from 'react';
import * as ReactDOM from 'react-dom';
import { useTripWorkspace } from '../../context/TripWorkspaceContext';
import { confirmUserAction } from '../../utils/confirmAction';
import { isPendingSubItemId } from '../../utils/itineraryEntryIds';
import { editableEntryToSubItem, subItemToEditableEntry } from '../../utils/optionEntryAdapter';
import { ItineraryCardEdit } from './ItineraryCardEdit';
import cardStyles from './ItineraryCard.module.css';

export const OptionEditPortal: React.FC = () => {
  const { editingSubItem, setEditingSubItem, localEntries, tripDays, updateSubItem, deleteSubItem } =
    useTripWorkspace();

  const ctx = React.useMemo(() => {
    if (!editingSubItem) return null;
    const parent = localEntries.find((e) => e.id === editingSubItem.parentEntryId);
    if (!parent) return null;
    const sub = parent.subItems?.find((s) => s.id === editingSubItem.subItemId);
    if (!sub) return null;
    const day = tripDays.find((d) => d.id === parent.dayId);
    return {
      parent,
      sub,
      calendarDate: day?.calendarDate?.slice(0, 10) ?? '',
      entry: subItemToEditableEntry(parent, sub)
    };
  }, [editingSubItem, localEntries, tripDays]);

  if (!ctx || typeof document === 'undefined') {
    return null;
  }

  const { parent, sub, calendarDate, entry } = ctx;

  const handleCancel = (): void => {
    void (async () => {
      if (isPendingSubItemId(sub.id) && !sub.title.trim()) {
        if (!(await confirmUserAction('Discard this new option?'))) return;
        deleteSubItem(parent.id, sub.id);
      }
      setEditingSubItem(null);
    })();
  };

  return ReactDOM.createPortal(
    <div className={cardStyles.portalEditRoot} role="presentation">
      <div className={cardStyles.portalEditInner}>
        <ItineraryCardEdit
          key={entry.id}
          entry={entry}
          calendarDate={calendarDate}
          variant="option"
          onSave={(saved) => {
            updateSubItem(parent.id, editableEntryToSubItem(saved, sub));
            setEditingSubItem(null);
          }}
          onCancel={handleCancel}
          onDelete={() => {
            void (async () => {
              if (!(await confirmUserAction('Delete this related option?'))) return;
              deleteSubItem(parent.id, sub.id);
              setEditingSubItem(null);
            })();
          }}
        />
      </div>
    </div>,
    document.body
  );
};
