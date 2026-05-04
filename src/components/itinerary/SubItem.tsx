import * as React from 'react';
import type { ItinerarySubItem } from '../../models/ItineraryEntry';
import { useTripWorkspace } from '../../context/TripWorkspaceContext';
import { SubItemDetailLines } from './SubItemDetailLines';
import styles from './SubItem.module.css';

export interface SubItemProps {
  item: ItinerarySubItem;
  parentEntryId: string;
}

function EditIcon(): React.ReactElement {
  return (
    <svg width={12} height={12} viewBox="0 0 16 16" fill="none" aria-hidden>
      <path d="M3 11.8 11.6 3.2l1.2 1.2L4.2 13H3v-1.2Z" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M9.9 4.9 11.1 6.1" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
    </svg>
  );
}

function DeleteIcon(): React.ReactElement {
  return (
    <svg width={12} height={12} viewBox="0 0 16 16" fill="none" aria-hidden>
      <path d="M4 4l8 8M12 4l-8 8" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
    </svg>
  );
}

export const SubItem: React.FC<SubItemProps> = ({ item, parentEntryId }) => {
  const { updateSubItem, deleteSubItem } = useTripWorkspace();
  const [isEditing, setIsEditing] = React.useState(false);
  const [draft, setDraft] = React.useState<ItinerarySubItem>({ ...item });

  React.useEffect(() => {
    if (!isEditing) {
      setDraft({ ...item });
    }
  }, [item, isEditing]);

  if (isEditing) {
    return (
      <div className={styles.editForm}>
        <input
          className={styles.field}
          type="text"
          value={draft.title}
          onChange={(e) => setDraft((prev) => ({ ...prev, title: e.target.value }))}
          placeholder="Sub-item title"
        />
        <div className={styles.editRow}>
          <input
            className={styles.field}
            type="time"
            value={draft.startTime ?? ''}
            onChange={(e) => setDraft((prev) => ({ ...prev, startTime: e.target.value || undefined }))}
            placeholder="Start time"
          />
          <input
            className={styles.field}
            type="time"
            value={draft.endTime ?? ''}
            onChange={(e) => setDraft((prev) => ({ ...prev, endTime: e.target.value || undefined }))}
            placeholder="End time"
          />
        </div>
        <div className={styles.editRow}>
          <select
            className={styles.field}
            value={draft.decisionStatus}
            onChange={(e) =>
              setDraft((prev) => ({ ...prev, decisionStatus: e.target.value as ItinerarySubItem['decisionStatus'] }))
            }
          >
            <option value="Idea">Idea</option>
            <option value="Planned">Planned</option>
            <option value="Confirmed">Confirmed</option>
          </select>
          <select
            className={styles.field}
            value={draft.paymentStatus}
            onChange={(e) => {
              const value = e.target.value as ItinerarySubItem['paymentStatus'];
              setDraft((prev) => ({
                ...prev,
                paymentStatus: value,
                amount: value === 'Free' ? 0 : prev.amount,
                amountPaid: value === 'Part paid' ? prev.amountPaid : undefined
              }));
            }}
          >
            <option value="Not paid">Not paid</option>
            <option value="Part paid">Part paid</option>
            <option value="Fully paid">Fully paid</option>
            <option value="Free">Free</option>
          </select>
          {draft.paymentStatus !== 'Free' ? (
            <input
              className={styles.field}
              type="number"
              min={0}
              value={draft.amount}
              onChange={(e) => setDraft((prev) => ({ ...prev, amount: Number(e.target.value) || 0 }))}
            />
          ) : null}
        </div>
        {draft.paymentStatus === 'Part paid' ? (
          <div className={styles.editRowSingle}>
            <input
              className={styles.field}
              type="number"
              min={0}
              max={draft.amount}
              step={0.01}
              placeholder="Amount paid so far"
              value={draft.amountPaid ?? ''}
              onChange={(e) =>
                setDraft((prev) => ({
                  ...prev,
                  amountPaid: e.target.value === '' ? undefined : Math.min(prev.amount, Number(e.target.value) || 0)
                }))
              }
            />
          </div>
        ) : null}
        <div className={styles.actions}>
          <button
            type="button"
            className={styles.actionButton}
            onClick={() => {
              updateSubItem(parentEntryId, draft);
              setIsEditing(false);
            }}
          >
            Save
          </button>
          <button
            type="button"
            className={styles.actionButton}
            onClick={() => {
              setDraft({ ...item });
              setIsEditing(false);
            }}
          >
            Cancel
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className={styles.row}>
      <div className={styles.detailWrap}>
        <SubItemDetailLines item={item} />
      </div>
      <div className={styles.actionCol}>
        <button type="button" className={styles.editButton} onClick={() => setIsEditing(true)} aria-label="Edit sub-item">
          <EditIcon />
        </button>
        <button
          type="button"
          className={styles.deleteButton}
          onClick={() => deleteSubItem(parentEntryId, item.id)}
          aria-label="Delete sub-item"
        >
          <DeleteIcon />
        </button>
      </div>
    </div>
  );
};
