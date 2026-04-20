import * as React from 'react';
import type { ItinerarySubItem } from '../../models/ItineraryEntry';
import { useTripWorkspace } from '../../context/TripWorkspaceContext';
import { formatNZD } from '../../utils/financialUtils';
import styles from './SubItem.module.css';

export interface SubItemProps {
  item: ItinerarySubItem;
  parentEntryId: string;
}

function decisionDotClass(status: ItinerarySubItem['decisionStatus']): string {
  if (status === 'Planned') {
    return styles.dotPlanned;
  }
  if (status === 'Confirmed') {
    return styles.dotConfirmed;
  }
  return styles.dotIdea;
}

function paymentBadgeClass(status: ItinerarySubItem['paymentStatus']): string {
  if (status === 'Fully paid') {
    return styles.paymentPaid;
  }
  if (status === 'Part paid') {
    return styles.paymentPart;
  }
  return styles.paymentUnpaid;
}

function EditIcon(): React.ReactElement {
  return (
    <svg width={12} height={12} viewBox="0 0 16 16" fill="none" aria-hidden>
      <path d="M3 11.8 11.6 3.2l1.2 1.2L4.2 13H3v-1.2Z" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M9.9 4.9 11.1 6.1" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
    </svg>
  );
}

export const SubItem: React.FC<SubItemProps> = ({ item, parentEntryId }) => {
  const { updateSubItem } = useTripWorkspace();
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
            onChange={(e) =>
              setDraft((prev) => ({ ...prev, paymentStatus: e.target.value as ItinerarySubItem['paymentStatus'] }))
            }
          >
            <option value="Not paid">Not paid</option>
            <option value="Part paid">Part paid</option>
            <option value="Fully paid">Fully paid</option>
          </select>
          <input
            className={styles.field}
            type="number"
            min={0}
            value={draft.amount}
            onChange={(e) => setDraft((prev) => ({ ...prev, amount: Number(e.target.value) || 0 }))}
          />
        </div>
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
      <div className={styles.left}>
        <span className={`${styles.dot} ${decisionDotClass(item.decisionStatus)}`} aria-hidden />
        <span className={styles.title}>{item.title}</span>
        <span className={`${styles.paymentBadge} ${paymentBadgeClass(item.paymentStatus)}`}>{item.paymentStatus}</span>
      </div>
      <div className={styles.right}>
        {item.amount === 0 ? <span className={styles.free}>Free</span> : <span className={styles.amount}>{formatNZD(item.amount)}</span>}
        <button type="button" className={styles.editButton} onClick={() => setIsEditing(true)} aria-label="Edit sub-item">
          <EditIcon />
        </button>
      </div>
    </div>
  );
};
