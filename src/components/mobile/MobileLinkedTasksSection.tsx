import * as React from 'react';
import { useSpContext } from '../../context/SpContext';
import { useTripWorkspace } from '../../context/TripWorkspaceContext';
import { ReminderService, type TripReminder } from '../../services/ReminderService';
import {
  linkedTaskDisplayText,
  linkedTaskNoteDisplay,
  type LinkedEntryTask
} from '../../utils/linkedEntryTask';
import { confirmUserAction } from '../../utils/confirmAction';
import styles from './MobileLinkedTasksSection.module.css';

export interface MobileLinkedTasksSectionProps {
  entryId: string;
  canEdit: boolean;
}

function toLinked(r: TripReminder): LinkedEntryTask {
  return {
    reminderId: r.id,
    text: r.reminderText || r.title || '',
    taskNote: r.taskNote,
    dueDate: r.dueDate,
    assignedTo: r.assignedTo,
    taskCategory: r.taskCategory
  };
}

/** Tasks linked to this itinerary item — view / edit / delete on the detail page. */
export const MobileLinkedTasksSection: React.FC<MobileLinkedTasksSectionProps> = ({
  entryId,
  canEdit
}) => {
  const spContext = useSpContext();
  const { trip } = useTripWorkspace();
  const [tasks, setTasks] = React.useState<LinkedEntryTask[]>([]);
  const [editingId, setEditingId] = React.useState<string | null>(null);
  const [draftText, setDraftText] = React.useState('');
  const [draftDue, setDraftDue] = React.useState('');
  const [adding, setAdding] = React.useState(false);
  const [newText, setNewText] = React.useState('');
  const [newDue, setNewDue] = React.useState('');

  const load = React.useCallback((): void => {
    if (!trip?.id || !entryId) {
      setTasks([]);
      return;
    }
    const svc = new ReminderService(spContext);
    void svc
      .getForTrip(trip.id)
      .then((rows) => {
        const linked = rows
          .filter((r) => {
            const eid = (r.entryId || '').trim();
            if (eid !== entryId) return false;
            const rt = (r.reminderType || '').trim();
            return rt === 'Manual' || rt === 'ManualEntryTask' || rt === 'Custom';
          })
          .map(toLinked);
        setTasks(linked);
      })
      .catch(() => setTasks([]));
  }, [spContext, trip?.id, entryId]);

  React.useEffect(() => {
    load();
  }, [load]);

  React.useEffect(() => {
    const onUp = (): void => load();
    window.addEventListener('trip-reminders-updated', onUp);
    return () => window.removeEventListener('trip-reminders-updated', onUp);
  }, [load]);

  const startEdit = (t: LinkedEntryTask): void => {
    setEditingId(t.reminderId);
    setDraftText(linkedTaskDisplayText(t));
    setDraftDue((t.dueDate || '').slice(0, 10));
  };

  const saveEdit = async (): Promise<void> => {
    if (!editingId || !trip?.id) return;
    const svc = new ReminderService(spContext);
    const rows = await svc.getForTrip(trip.id);
    const row = rows.find((r) => r.id === editingId);
    if (!row) return;
    await svc.update(editingId, {
      reminderText: draftText.trim() || row.reminderText,
      title: draftText.trim() || row.title,
      dueDate: draftDue || undefined
    });
    setEditingId(null);
    window.dispatchEvent(new Event('trip-reminders-updated'));
    load();
  };

  const removeTask = async (id: string): Promise<void> => {
    if (!(await confirmUserAction('Delete this task?'))) return;
    const svc = new ReminderService(spContext);
    await svc.delete(id);
    window.dispatchEvent(new Event('trip-reminders-updated'));
    load();
  };

  const addTask = async (): Promise<void> => {
    if (!trip?.id || !newText.trim()) return;
    const svc = new ReminderService(spContext);
    await svc.create({
      tripId: trip.id,
      entryId,
      reminderType: 'Manual',
      reminderText: newText.trim(),
      title: newText.trim(),
      dueDate: newDue || undefined,
      isComplete: false
    });
    setNewText('');
    setNewDue('');
    setAdding(false);
    window.dispatchEvent(new Event('trip-reminders-updated'));
    load();
  };

  return (
    <section className={styles.root}>
      <div className={styles.head}>
        <h2 className={styles.title}>Tasks</h2>
        {canEdit ? (
          <button type="button" className={styles.addBtn} onClick={() => setAdding((v) => !v)}>
            {adding ? 'Cancel' : '+ Add task'}
          </button>
        ) : null}
      </div>

      {adding ? (
        <div className={styles.editBox}>
          <input
            className={styles.input}
            value={newText}
            onChange={(e) => setNewText(e.target.value)}
            placeholder="Task title"
            aria-label="New task title"
          />
          <input
            className={styles.input}
            type="date"
            value={newDue}
            onChange={(e) => setNewDue(e.target.value)}
            aria-label="Due date"
          />
          <button type="button" className={styles.saveBtn} disabled={!newText.trim()} onClick={() => void addTask()}>
            Save task
          </button>
        </div>
      ) : null}

      {!tasks.length && !adding ? <p className={styles.empty}>No tasks linked to this item yet.</p> : null}

      <ul className={styles.list}>
        {tasks.map((t) => {
          const note = linkedTaskNoteDisplay(t);
          const isEditing = editingId === t.reminderId;
          return (
            <li key={t.reminderId} className={styles.item}>
              {isEditing ? (
                <div className={styles.editBox}>
                  <input
                    className={styles.input}
                    value={draftText}
                    onChange={(e) => setDraftText(e.target.value)}
                    aria-label="Task title"
                  />
                  <input
                    className={styles.input}
                    type="date"
                    value={draftDue}
                    onChange={(e) => setDraftDue(e.target.value)}
                    aria-label="Due date"
                  />
                  <div className={styles.rowActions}>
                    <button type="button" className={styles.saveBtn} onClick={() => void saveEdit()}>
                      Save
                    </button>
                    <button type="button" className={styles.linkBtn} onClick={() => setEditingId(null)}>
                      Cancel
                    </button>
                  </div>
                </div>
              ) : (
                <>
                  <div className={styles.itemBody}>
                    <span className={styles.itemTitle}>{linkedTaskDisplayText(t)}</span>
                    {t.dueDate ? (
                      <span className={styles.meta}>Due {new Date(t.dueDate).toLocaleDateString('en-NZ')}</span>
                    ) : null}
                    {note ? <span className={styles.meta}>{note}</span> : null}
                    {t.assignedTo ? <span className={styles.meta}>{t.assignedTo}</span> : null}
                  </div>
                  {canEdit ? (
                    <div className={styles.rowActions}>
                      <button type="button" className={styles.linkBtn} onClick={() => startEdit(t)}>
                        Edit
                      </button>
                      <button type="button" className={styles.dangerBtn} onClick={() => void removeTask(t.reminderId)}>
                        Delete
                      </button>
                    </div>
                  ) : null}
                </>
              )}
            </li>
          );
        })}
      </ul>
    </section>
  );
};
