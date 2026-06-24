import * as React from 'react';
import * as ReactDOM from 'react-dom';
import type { ItinerarySubItem } from '../../models/ItineraryEntry';
import { useTripWorkspace } from '../../context/TripWorkspaceContext';
import { confirmUserAction } from '../../utils/confirmAction';
import { useSpContext } from '../../context/SpContext';
import { useAttachments } from '../../context/AttachmentsContext';
import { ReminderService } from '../../services/ReminderService';
import { googleMapsDirectionsUrl, googleMapsPlaceUrl } from '../../utils/googleMapsLink';
import type { EntryDocumentType, EntryLinkType } from '../../models';
import { SubItemDetailLines } from './SubItemDetailLines';
import { EntryFilesLinksPanel } from './EntryFilesLinksPanel';
import cardMenuStyles from './ItineraryCardView.module.css';
import styles from './SubItem.module.css';

export interface SubItemProps {
  item: ItinerarySubItem;
  parentEntryId: string;
  dragHandle?: React.ReactNode;
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
    moveSubItem,
    persistSubItem
  } = useTripWorkspace();
  const { docsForEntry, linksForEntry, addDocument, addLink } = useAttachments();
  const [taskBusy, setTaskBusy] = React.useState(false);
  const [taskPanelOpen, setTaskPanelOpen] = React.useState(false);
  const [taskDesc, setTaskDesc] = React.useState('');
  const [menuOpen, setMenuOpen] = React.useState(false);
  const [moveOpen, setMoveOpen] = React.useState(false);
  const menuButtonRef = React.useRef<HTMLButtonElement>(null);
  const menuPortalRef = React.useRef<HTMLDivElement>(null);
  const [menuAnchor, setMenuAnchor] = React.useState({ top: 0, left: 0, width: 140 });

  const parentEntry = React.useMemo(() => localEntries.find((e) => e.id === parentEntryId), [localEntries, parentEntryId]);
  const calendarDate = React.useMemo(() => {
    const day = tripDays.find((d) => d.id === parentEntry?.dayId);
    return day?.calendarDate?.slice(0, 10) ?? '';
  }, [tripDays, parentEntry?.dayId]);

  const moveTargetGroups = React.useMemo(() => {
    const sortedDays = [...tripDays].sort((a, b) => a.dayNumber - b.dayNumber);
    return sortedDays
      .map((day) => ({
        day,
        entries: localEntries.filter(
          (e) => !e.parentEntryId && e.id !== parentEntryId && e.id !== item.id && e.dayId === day.id
        )
      }))
      .filter((g) => g.entries.length > 0);
  }, [localEntries, tripDays, parentEntryId, item.id]);

  const hasMoveTargets = moveTargetGroups.some((g) => g.entries.length > 0);

  const docs = docsForEntry(item.id);
  const links = linksForEntry(item.id);
  const isEditingInPanel =
    editingSubItem?.parentEntryId === parentEntryId && editingSubItem?.subItemId === item.id;

  React.useEffect(() => {
    if (!menuOpen || !menuButtonRef.current) return;
    const rect = menuButtonRef.current.getBoundingClientRect();
    setMenuAnchor({ top: rect.bottom + 4, left: rect.right - 160, width: 160 });
  }, [menuOpen]);

  React.useEffect(() => {
    if (!menuOpen) return;
    const onDoc = (e: MouseEvent): void => {
      const t = e.target as Node;
      if (menuPortalRef.current?.contains(t) || menuButtonRef.current?.contains(t)) return;
      setMenuOpen(false);
      setMoveOpen(false);
    };
    document.addEventListener('mousedown', onDoc);
    return () => document.removeEventListener('mousedown', onDoc);
  }, [menuOpen]);

  const handleUploadDocument = React.useCallback(
    async (file: File, documentType: EntryDocumentType, notes: string, title?: string) => {
      if (!parentEntry) return;
      const persisted = await persistSubItem(parentEntryId, item);
      await addDocument({
        file,
        dayId: parentEntry.dayId,
        entryId: persisted.id,
        documentType,
        notes,
        title
      });
    },
    [addDocument, item, parentEntry, parentEntryId, persistSubItem]
  );

  const handleAddLink = React.useCallback(
    async (draft: { linkTitle: string; url: string; linkType: EntryLinkType; notes: string }) => {
      if (!parentEntry) return;
      const persisted = await persistSubItem(parentEntryId, item);
      await addLink({
        dayId: parentEntry.dayId,
        entryId: persisted.id,
        linkType: draft.linkType,
        url: draft.url,
        linkTitle: draft.linkTitle,
        notes: draft.notes
      });
    },
    [addLink, item, parentEntry, parentEntryId, persistSubItem]
  );

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

  const optionMenuPortal =
    menuOpen && typeof document !== 'undefined'
      ? ReactDOM.createPortal(
          <div
            ref={menuPortalRef}
            className={cardMenuStyles.dropdownPortal}
            role="menu"
            style={{ top: menuAnchor.top, left: menuAnchor.left, minWidth: menuAnchor.width }}
          >
            <button
              type="button"
              role="menuitem"
              onClick={() => {
                setMenuOpen(false);
                setEditingSubItem({ parentEntryId, subItemId: item.id });
              }}
            >
              Edit
            </button>
            <button
              type="button"
              role="menuitem"
              onClick={() => {
                setMenuOpen(false);
                duplicateSubItem(parentEntryId, item.id);
              }}
            >
              Duplicate
            </button>
            {hasMoveTargets ? (
              <button
                type="button"
                role="menuitem"
                onClick={() => setMoveOpen((v) => !v)}
              >
                Move to card…
              </button>
            ) : null}
            {moveOpen && hasMoveTargets ? (
              <div className={styles.moveMenuPanel}>
                <select
                  className={styles.moveSelect}
                  value=""
                  aria-label="Move option to another card"
                  onChange={(e) => {
                    const toId = e.target.value;
                    if (!toId) return;
                    moveSubItem(parentEntryId, item.id, toId);
                    e.target.value = '';
                    setMenuOpen(false);
                    setMoveOpen(false);
                  }}
                >
                  <option value="">Choose card…</option>
                  {moveTargetGroups.map(({ day, entries }) => (
                    <optgroup key={day.id} label={`Day ${day.dayNumber} — ${day.displayTitle || 'Untitled'}`}>
                      {entries.map((target) => (
                        <option key={target.id} value={target.id}>
                          {target.title?.trim() || target.category || 'Card'}
                        </option>
                      ))}
                    </optgroup>
                  ))}
                </select>
              </div>
            ) : null}
            <button
              type="button"
              role="menuitem"
              onClick={() => {
                setMenuOpen(false);
                setTaskPanelOpen(true);
                setTaskDesc(`Book ${item.title || 'option'}`);
              }}
            >
              Add to tasks
            </button>
            <button
              type="button"
              role="menuitem"
              onClick={() => {
                setMenuOpen(false);
                void (async () => {
                  if (!(await confirmUserAction('Delete this related option?'))) return;
                  deleteSubItem(parentEntryId, item.id);
                })();
              }}
            >
              Delete
            </button>
          </div>,
          document.body
        )
      : null;

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
        <EntryFilesLinksPanel
          entryId={item.id}
          docs={docs}
          links={links}
          allowAdd
          onUploadDocument={handleUploadDocument}
          onAddLink={handleAddLink}
        />
      </div>
      <div className={styles.actionCol}>
        {dragHandle ? <span className={styles.dragHandleSlot}>{dragHandle}</span> : null}
        <div className={cardMenuStyles.menuWrap}>
          <button
            ref={menuButtonRef}
            type="button"
            className={cardMenuStyles.menuButton}
            aria-expanded={menuOpen}
            aria-haspopup="menu"
            aria-label="Option actions"
            onClick={() => setMenuOpen((o) => !o)}
          >
            ⋯
          </button>
        </div>
      </div>
      {optionMenuPortal}
    </div>
  );
};
