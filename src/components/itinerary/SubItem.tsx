import * as React from 'react';
import type { ItinerarySubItem } from '../../models/ItineraryEntry';
import { useTripWorkspace } from '../../context/TripWorkspaceContext';
import { confirmUserAction } from '../../utils/confirmAction';
import { useSpContext } from '../../context/SpContext';
import { useAttachments } from '../../context/AttachmentsContext';
import { ReminderService } from '../../services/ReminderService';
import { openDocumentUrl } from '../../utils/openDocumentUrl';
import { googleMapsDirectionsUrl, googleMapsPlaceUrl } from '../../utils/googleMapsLink';
import { SubItemDetailLines } from './SubItemDetailLines';
import { EntryLinksSortableList } from './EntryLinksSortableList';
import linkSortStyles from './EntryLinksSortableList.module.css';
import styles from './SubItem.module.css';

export interface SubItemProps {
  item: ItinerarySubItem;
  parentEntryId: string;
  dragHandle?: React.ReactNode;
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

function DuplicateIcon(): React.ReactElement {
  return (
    <svg width={12} height={12} viewBox="0 0 16 16" fill="none" aria-hidden>
      <rect x="5.5" y="5.5" width="7" height="7" rx="1" stroke="currentColor" strokeWidth="1.2" />
      <path d="M3.5 10.5V3.5a1 1 0 0 1 1-1H10" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" />
    </svg>
  );
}

export const SubItem: React.FC<SubItemProps> = ({ item, parentEntryId, dragHandle }) => {
  const spContext = useSpContext();
  const {
    trip,
    localEntries,
    tripDays,
    deleteSubItem,
    setEditingSubItem,
    editingSubItem,
    duplicateSubItem,
    moveSubItem
  } = useTripWorkspace();
  const { docsForEntry, linksForEntry, updateLink, deleteLink } = useAttachments();
  const [taskBusy, setTaskBusy] = React.useState(false);
  const [taskPanelOpen, setTaskPanelOpen] = React.useState(false);
  const [taskDesc, setTaskDesc] = React.useState('');
  const [attachOpen, setAttachOpen] = React.useState(false);
  const [editingLinkId, setEditingLinkId] = React.useState<string | null>(null);
  const [linkEditDraft, setLinkEditDraft] = React.useState({ linkTitle: '', url: '' });

  const parentEntry = React.useMemo(() => localEntries.find((e) => e.id === parentEntryId), [localEntries, parentEntryId]);
  const calendarDate = React.useMemo(() => {
    const day = tripDays.find((d) => d.id === parentEntry?.dayId);
    return day?.calendarDate?.slice(0, 10) ?? '';
  }, [tripDays, parentEntry?.dayId]);
  const moveTargets = React.useMemo(
    () =>
      localEntries.filter(
        (e) =>
          e.dayId === parentEntry?.dayId &&
          !e.parentEntryId &&
          e.id !== parentEntryId &&
          e.id !== item.id
      ),
    [localEntries, parentEntry?.dayId, parentEntryId, item.id]
  );
  const docs = docsForEntry(item.id);
  const links = linksForEntry(item.id);
  const isEditingInPanel =
    editingSubItem?.parentEntryId === parentEntryId && editingSubItem?.subItemId === item.id;

  React.useEffect(() => {
    if (docs.length + links.length > 0) {
      setAttachOpen(true);
    }
  }, [item.id, docs.length, links.length]);

  const submitOptionTask = React.useCallback(() => {
    if (!trip?.id || !parentEntry) return;
    setTaskBusy(true);
    const svc = new ReminderService(spContext);
    const note = taskDesc.trim();
    void svc
      .create({
        title: `Option: ${parentEntry.title || 'Item'} — ${item.title || 'Untitled'}`,
        tripId: trip.id,
        dayId: parentEntry.dayId,
        entryId: item.id,
        reminderType: 'Option',
        reminderText: note || `Follow up option: ${item.title || 'Untitled'}`,
        taskNote: note || undefined,
        isComplete: false
      })
      .then(() => {
        window.dispatchEvent(new Event('trip-reminders-updated'));
        setTaskPanelOpen(false);
        setTaskDesc('');
      })
      .catch(console.error)
      .then(() => setTaskBusy(false));
  }, [spContext, trip?.id, parentEntry, item.id, item.title, taskDesc]);

  const viewMapsPlaceUrl = googleMapsPlaceUrl(item.streetAddress || '');
  const viewMapsDirectionsUrl = googleMapsDirectionsUrl(item.streetAddress || '');

  return (
    <div className={`${styles.optionInline} ${isEditingInPanel ? styles.optionInlineActive : ''}`}>
      <div className={styles.optionBody}>
        {taskPanelOpen ? (
          <div className={styles.taskPanel}>
            <label className={styles.taskLabel} htmlFor={`opt-task-${item.id}`}>
              Task description (optional)
            </label>
            <input
              id={`opt-task-${item.id}`}
              className={styles.field}
              type="text"
              value={taskDesc}
              onChange={(e) => setTaskDesc(e.target.value)}
              placeholder={`Book ${item.title || 'option'}`}
            />
            <div className={styles.taskPanelActions}>
              <button type="button" className={styles.actionButton} disabled={taskBusy} onClick={submitOptionTask}>
                Add task
              </button>
              <button
                type="button"
                className={styles.actionButtonMuted}
                onClick={() => {
                  setTaskPanelOpen(false);
                  setTaskDesc('');
                }}
              >
                Cancel
              </button>
            </div>
          </div>
        ) : null}
        <SubItemDetailLines item={item} calendarDate={calendarDate} docCount={docs.length} linkCount={links.length} />
        {viewMapsPlaceUrl ? (
          <div className={styles.mapsRow}>
            <a href={viewMapsPlaceUrl} target="_blank" rel="noopener noreferrer">
              Open in Maps
            </a>
            {viewMapsDirectionsUrl ? (
              <a href={viewMapsDirectionsUrl} target="_blank" rel="noopener noreferrer">
                Directions
              </a>
            ) : null}
          </div>
        ) : null}
        {(docs.length > 0 || links.length > 0) ? (
          <>
            <button type="button" className={styles.attachToggle} onClick={() => setAttachOpen((o) => !o)}>
              {attachOpen ? 'Hide files & links ▴' : `Files & links (${docs.length + links.length}) ▾`}
            </button>
            {attachOpen ? (
              <div className={styles.quickLinks}>
                {docs.map((d) => (
                  <button key={d.id} type="button" className={styles.miniLink} onClick={() => openDocumentUrl(d.fileUrl)} title={d.title}>
                    {d.title || 'File'}
                  </button>
                ))}
                <EntryLinksSortableList entryId={item.id} links={links} className={styles.quickLinks}>
                  {(l, dragHandle) =>
                    editingLinkId === l.id ? (
                      <div key={l.id} className={styles.linkEditRow}>
                        {dragHandle ? <span className={linkSortStyles.dragHandleSlot}>{dragHandle}</span> : null}
                        <input
                          className={styles.field}
                          value={linkEditDraft.linkTitle}
                          onChange={(e) => setLinkEditDraft((prev) => ({ ...prev, linkTitle: e.target.value }))}
                          placeholder="Link title"
                        />
                        <input
                          className={styles.field}
                          value={linkEditDraft.url}
                          onChange={(e) => setLinkEditDraft((prev) => ({ ...prev, url: e.target.value }))}
                          placeholder="URL"
                        />
                        <button
                          type="button"
                          className={styles.actionButton}
                          onClick={() => {
                            updateLink(l.id, {
                              linkTitle: linkEditDraft.linkTitle.trim(),
                              url: linkEditDraft.url.trim()
                            })
                              .then(() => setEditingLinkId(null))
                              .catch(console.error);
                          }}
                        >
                          Save
                        </button>
                        <button type="button" className={styles.actionButtonMuted} onClick={() => setEditingLinkId(null)}>
                          Cancel
                        </button>
                      </div>
                    ) : (
                      <span key={l.id} className={styles.linkChip}>
                        {dragHandle}
                        <button type="button" className={styles.miniLink} onClick={() => openDocumentUrl(l.url)} title={l.url}>
                          {l.linkTitle || l.url}
                        </button>
                        <button
                          type="button"
                          className={styles.linkChipAction}
                          aria-label="Edit link"
                          onClick={() => {
                            setEditingLinkId(l.id);
                            setLinkEditDraft({ linkTitle: l.linkTitle, url: l.url });
                          }}
                        >
                          ✎
                        </button>
                        <button
                          type="button"
                          className={styles.linkChipAction}
                          aria-label="Delete link"
                          onClick={() => {
                            void (async () => {
                              if (!(await confirmUserAction('Remove this link?'))) return;
                              deleteLink(l.id).catch(console.error);
                            })();
                          }}
                        >
                          ×
                        </button>
                      </span>
                    )
                  }
                </EntryLinksSortableList>
              </div>
            ) : null}
          </>
        ) : null}
      </div>
      <div className={styles.actionCol}>
        {dragHandle ? <span className={styles.dragHandleSlot}>{dragHandle}</span> : null}
        {moveTargets.length > 0 ? (
          <select
            className={styles.moveSelect}
            value=""
            aria-label="Move option to another card"
            title="Move to card"
            onChange={(e) => {
              const toId = e.target.value;
              if (!toId) return;
              moveSubItem(parentEntryId, item.id, toId);
              e.target.value = '';
            }}
          >
            <option value="">Move…</option>
            {moveTargets.map((target) => (
              <option key={target.id} value={target.id}>
                {target.title?.trim() || target.category || 'Card'}
              </option>
            ))}
          </select>
        ) : null}
        <button
          type="button"
          className={styles.editButton}
          onClick={() => duplicateSubItem(parentEntryId, item.id)}
          aria-label="Duplicate option"
          title="Duplicate"
        >
          <DuplicateIcon />
        </button>
        <button
          type="button"
          className={styles.taskButton}
          onClick={() => {
            setTaskPanelOpen((o) => {
              const next = !o;
              if (!o) {
                setTaskDesc(`Book ${item.title || 'option'}`);
              }
              return next;
            });
          }}
          disabled={taskBusy}
          aria-label="Add option to tasks"
          title="Add to tasks"
        >
          <TaskIcon />
        </button>
        <button
          type="button"
          className={styles.editButton}
          onClick={() => setEditingSubItem({ parentEntryId, subItemId: item.id })}
          aria-label="Edit option"
        >
          <EditIcon />
        </button>
        <button
          type="button"
          className={styles.deleteButton}
          onClick={() => {
            void (async () => {
              if (!(await confirmUserAction('Delete this related option?'))) return;
              deleteSubItem(parentEntryId, item.id);
            })();
          }}
          aria-label="Delete option"
        >
          <DeleteIcon />
        </button>
      </div>
    </div>
  );
};
