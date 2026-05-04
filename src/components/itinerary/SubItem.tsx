import * as React from 'react';
import type { ItinerarySubItem } from '../../models/ItineraryEntry';
import { useTripWorkspace } from '../../context/TripWorkspaceContext';
import { useSpContext } from '../../context/SpContext';
import { useAttachments } from '../../context/AttachmentsContext';
import { ReminderService } from '../../services/ReminderService';
import { openDocumentUrl } from '../../utils/openDocumentUrl';
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

function TaskIcon(): React.ReactElement {
  return (
    <svg width={12} height={12} viewBox="0 0 16 16" fill="none" aria-hidden>
      <path d="M3.5 3.5h9v9h-9v-9Z" stroke="currentColor" strokeWidth="1.2" />
      <path d="M5.5 7.5h5M5.5 10h3" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" />
    </svg>
  );
}

export const SubItem: React.FC<SubItemProps> = ({ item, parentEntryId }) => {
  const spContext = useSpContext();
  const { trip, localEntries, updateSubItem, deleteSubItem } = useTripWorkspace();
  const { docsForEntry, linksForEntry, addDocument, addLink } = useAttachments();
  const [isEditing, setIsEditing] = React.useState(false);
  const [draft, setDraft] = React.useState<ItinerarySubItem>({ ...item });
  const [taskBusy, setTaskBusy] = React.useState(false);
  const [linkTitle, setLinkTitle] = React.useState('');
  const [linkUrl, setLinkUrl] = React.useState('');
  const [uploadBusy, setUploadBusy] = React.useState(false);
  const fileRef = React.useRef<HTMLInputElement | null>(null);

  const parentEntry = React.useMemo(() => localEntries.find((e) => e.id === parentEntryId), [localEntries, parentEntryId]);
  const docs = docsForEntry(item.id);
  const links = linksForEntry(item.id);

  React.useEffect(() => {
    if (!isEditing) {
      setDraft({ ...item });
    }
  }, [item, isEditing]);

  const addToTasks = React.useCallback(() => {
    if (!trip?.id || !parentEntry) return;
    setTaskBusy(true);
    const svc = new ReminderService(spContext);
    void svc
      .create({
        title: `Option: ${parentEntry.title || 'Item'} — ${item.title || 'Untitled'}`,
        tripId: trip.id,
        dayId: parentEntry.dayId,
        entryId: item.id,
        reminderType: 'Option',
        reminderText: `Follow up option: ${item.title || 'Untitled'}`,
        isComplete: false
      })
      .then(() => {
        window.dispatchEvent(new Event('trip-reminders-updated'));
      })
      .catch(console.error)
      .then(() => setTaskBusy(false));
  }, [spContext, trip?.id, parentEntry, item.id, item.title]);

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
        <div className={styles.checkboxRow}>
          <input
            id={`br-${item.id}`}
            type="checkbox"
            checked={draft.bookingRequired === true}
            onChange={(e) => setDraft((prev) => ({ ...prev, bookingRequired: e.target.checked }))}
          />
          <label htmlFor={`br-${item.id}`}>Booking required</label>
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
        {parentEntry ? (
          <div className={styles.attachToolbar}>
            <button type="button" className={styles.actionButton} disabled={uploadBusy} onClick={() => fileRef.current?.click()}>
              {uploadBusy ? 'Upload…' : 'Add file'}
            </button>
            <input
              ref={fileRef}
              type="file"
              className={styles.fileHidden}
              onChange={(ev) => {
                const f = ev.target.files?.[0];
                if (!f || !parentEntry) return;
                setUploadBusy(true);
                void addDocument({ file: f, dayId: parentEntry.dayId, entryId: item.id, documentType: 'Other', notes: '' })
                  .catch(console.error)
                  .then(() => {
                    setUploadBusy(false);
                    ev.target.value = '';
                  });
              }}
            />
            <input
              className={styles.field}
              placeholder="Link title"
              value={linkTitle}
              onChange={(e) => setLinkTitle(e.target.value)}
            />
            <input
              className={styles.field}
              placeholder="URL"
              value={linkUrl}
              onChange={(e) => setLinkUrl(e.target.value)}
            />
            <button
              type="button"
              className={styles.actionButton}
              onClick={() => {
                const t = linkTitle.trim();
                const u = linkUrl.trim();
                if (!t || !u || !parentEntry) return;
                addLink({ dayId: parentEntry.dayId, entryId: item.id, linkType: 'Url', url: u, linkTitle: t })
                  .then(() => {
                    setLinkTitle('');
                    setLinkUrl('');
                  })
                  .catch(console.error);
              }}
            >
              Add link
            </button>
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
        <SubItemDetailLines item={item} docCount={docs.length} linkCount={links.length} />
        {(docs.length > 0 || links.length > 0) ? (
          <div className={styles.quickLinks}>
            {docs.map((d) => (
              <button key={d.id} type="button" className={styles.miniLink} onClick={() => openDocumentUrl(d.fileUrl)} title={d.title}>
                File
              </button>
            ))}
            {links.map((l) => (
              <button key={l.id} type="button" className={styles.miniLink} onClick={() => openDocumentUrl(l.url)} title={l.linkTitle}>
                Link
              </button>
            ))}
          </div>
        ) : null}
      </div>
      <div className={styles.actionCol}>
        <button type="button" className={styles.taskButton} onClick={addToTasks} disabled={taskBusy} aria-label="Add option to tasks" title="Add to tasks">
          <TaskIcon />
        </button>
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
