import * as React from 'react';
import { useSpContext } from '../../context/SpContext';
import { useTripWorkspace } from '../../context/TripWorkspaceContext';
import { ReminderService } from '../../services/ReminderService';
import { DAY_IDEA_REMINDER_TYPE, formatDayIdeaStamp } from '../../utils/dayIdeas';
import { getCurrentUserDisplayName } from '../../utils/currentUserEmail';
import { confirmUserAction } from '../../utils/confirmAction';
import styles from './MobileItinerary.module.css';

export interface MobileDayIdeasProps {
  dayId: string;
  readOnly?: boolean;
}

export const MobileDayIdeas: React.FC<MobileDayIdeasProps> = ({ dayId, readOnly = false }) => {
  const spContext = useSpContext();
  const { trip } = useTripWorkspace();
  const [rows, setRows] = React.useState<Awaited<ReturnType<ReminderService['getForTrip']>>>([]);
  const [draft, setDraft] = React.useState('');
  const [editingId, setEditingId] = React.useState<string | null>(null);
  const [editText, setEditText] = React.useState('');
  const [busy, setBusy] = React.useState(false);

  const refresh = React.useCallback(() => {
    if (!trip?.id) return;
    const svc = new ReminderService(spContext);
    void svc.getForTrip(trip.id).then((all) => {
      setRows(
        all
          .filter((r) => r.reminderType === DAY_IDEA_REMINDER_TYPE && r.dayId === dayId)
          .sort((a, b) => (b.dueDate || '').localeCompare(a.dueDate || ''))
      );
    });
  }, [trip?.id, dayId, spContext]);

  React.useEffect(() => {
    refresh();
  }, [refresh]);

  const addIdea = async (): Promise<void> => {
    const text = draft.trim();
    if (!text || !trip?.id || readOnly) return;
    setBusy(true);
    try {
      const svc = new ReminderService(spContext);
      await svc.create({
        title: text,
        tripId: trip.id,
        dayId,
        reminderType: DAY_IDEA_REMINDER_TYPE,
        reminderText: text,
        assignedTo: getCurrentUserDisplayName(spContext),
        isComplete: false,
        dueDate: new Date().toISOString(),
        entryId: ''
      });
      setDraft('');
      refresh();
    } finally {
      setBusy(false);
    }
  };

  const saveEdit = async (id: string): Promise<void> => {
    const text = editText.trim();
    if (!text) return;
    const svc = new ReminderService(spContext);
    await svc.update(id, { title: text, reminderText: text });
    setEditingId(null);
    setEditText('');
    refresh();
  };

  return (
    <section className={styles.dayIdeasSection}>
      <div className={styles.dayIdeasHead}>
        <h3 className={styles.dayIdeasTitle}>Ideas for this day</h3>
        <span className={styles.dayIdeasHint}>Swap ideas as you plan — check off when agreed</span>
      </div>
      {rows.length ? (
        <ul className={styles.dayIdeasList}>
          {rows.map((row) => {
            const editing = editingId === row.id;
            return (
              <li key={row.id} className={`${styles.dayIdeaRow} ${row.isComplete ? styles.dayIdeaDone : ''}`}>
                <input
                  className={styles.dayIdeaCheck}
                  type="checkbox"
                  checked={row.isComplete}
                  disabled={readOnly}
                  aria-label={row.isComplete ? 'Mark as open idea' : 'Mark idea as agreed'}
                  onChange={() => {
                    const svc = new ReminderService(spContext);
                    void svc.update(row.id, { isComplete: !row.isComplete }).then(refresh);
                  }}
                />
                <div className={styles.dayIdeaBody}>
                  {editing ? (
                    <input
                      className={styles.dayIdeaInput}
                      value={editText}
                      onChange={(e) => setEditText(e.target.value)}
                      aria-label="Edit idea"
                    />
                  ) : (
                    <p className={styles.dayIdeaText}>{row.reminderText || row.title}</p>
                  )}
                  <p className={styles.dayIdeaMeta}>
                    {row.assignedTo?.trim() ? `${row.assignedTo.trim()} · ` : ''}
                    {formatDayIdeaStamp(row.dueDate)}
                  </p>
                </div>
                {!readOnly ? (
                  <div className={styles.dayIdeaActions}>
                    {editing ? (
                      <>
                        <button type="button" className={styles.dayIdeaBtn} onClick={() => void saveEdit(row.id)}>
                          Save
                        </button>
                        <button type="button" className={styles.dayIdeaBtn} onClick={() => setEditingId(null)}>
                          Cancel
                        </button>
                      </>
                    ) : (
                      <>
                        <button
                          type="button"
                          className={styles.dayIdeaBtn}
                          onClick={() => {
                            setEditingId(row.id);
                            setEditText(row.reminderText || row.title);
                          }}
                        >
                          Edit
                        </button>
                        <button
                          type="button"
                          className={styles.dayIdeaBtn}
                          onClick={() => {
                            void (async () => {
                              if (!(await confirmUserAction('Delete this idea?'))) return;
                              const svc = new ReminderService(spContext);
                              await svc.delete(row.id);
                              refresh();
                            })();
                          }}
                        >
                          Delete
                        </button>
                      </>
                    )}
                  </div>
                ) : null}
              </li>
            );
          })}
        </ul>
      ) : (
        <p className={styles.dayIdeasEmpty}>No ideas yet — add one below.</p>
      )}
      {!readOnly ? (
        <div className={styles.dayIdeasAdd}>
          <input
            className={styles.dayIdeaInput}
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            placeholder="Add an idea for this day…"
            aria-label="New day idea"
            onKeyDown={(e) => {
              if (e.key === 'Enter' && draft.trim()) void addIdea();
            }}
          />
          <button type="button" className={styles.dayIdeasAddBtn} disabled={busy || !draft.trim()} onClick={() => void addIdea()}>
            Add
          </button>
        </div>
      ) : null}
    </section>
  );
};
