import * as React from 'react';
import { useSpContext } from '../../context/SpContext';
import { useTripWorkspace } from '../../context/TripWorkspaceContext';
import { useTripRole } from '../../context/TripRoleContext';
import { useTripMembers } from '../../hooks/useTripMembers';
import { useTripPermissions } from '../../hooks/useTripPermissions';
import { ReminderService } from '../../services/ReminderService';
import { confirmUserAction } from '../../utils/confirmAction';
import {
  buildDayIdeaMetaForCreate,
  DAY_IDEA_REMINDER_TYPE,
  formatDayIdeaAuthor,
  formatDayIdeaStamp,
  isDayIdeaAuthor,
  isDayIdeaUnread
} from '../../utils/dayIdeas';
import { travellerLabelForCurrentUser } from '../../utils/tripMemberIdentity';
import { notifyDayIdeasChanged } from '../../hooks/useTripDayIdeas';
import { DayIdeaReplies } from '../dayIdeas/DayIdeaReplies';
import styles from './MobileItinerary.module.css';

export interface MobileDayIdeasProps {
  dayId: string;
}

export const MobileDayIdeas: React.FC<MobileDayIdeasProps> = ({ dayId }) => {
  const spContext = useSpContext();
  const { trip } = useTripWorkspace();
  const { role } = useTripRole();
  const { members } = useTripMembers(trip?.id);
  const { canEditItinerary } = useTripPermissions();
  const canContribute = role === 'Editor' || role === 'Companion';

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

  React.useEffect(() => {
    const handler = (): void => refresh();
    window.addEventListener('travelhub-day-ideas-changed', handler);
    return () => window.removeEventListener('travelhub-day-ideas-changed', handler);
  }, [refresh]);

  const canManageRow = React.useCallback(
    (row: (typeof rows)[0]): boolean => {
      if (canEditItinerary) return true;
      return isDayIdeaAuthor(row, spContext, members);
    },
    [canEditItinerary, spContext, members]
  );

  const addIdea = async (): Promise<void> => {
    const text = draft.trim();
    if (!text || !trip?.id || !canContribute) return;
    setBusy(true);
    try {
      const svc = new ReminderService(spContext);
      await svc.create({
        title: text,
        tripId: trip.id,
        dayId,
        reminderType: DAY_IDEA_REMINDER_TYPE,
        reminderText: text,
        taskNote: buildDayIdeaMetaForCreate(spContext),
        assignedTo: travellerLabelForCurrentUser(spContext, members),
        isComplete: false,
        dueDate: new Date().toISOString(),
        entryId: ''
      });
      setDraft('');
      refresh();
      notifyDayIdeasChanged();
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
    notifyDayIdeasChanged();
  };

  const dayUnread = rows.filter((r) => isDayIdeaUnread(r, spContext, members)).length;

  return (
    <section className={styles.dayIdeasSection}>
      <div className={styles.dayIdeasHead}>
        <div className={styles.dayIdeasTitleRow}>
          <h3 className={styles.dayIdeasTitle}>Ideas for this day</h3>
          {dayUnread > 0 ? <span className={styles.dayIdeasNewBadge}>{dayUnread} new</span> : null}
        </div>
        <span className={styles.dayIdeasHint}>Swap ideas as you plan — check off when agreed. Day ideas also appear under Lists → Ideas when moved to the jotter.</span>
      </div>
      {rows.length ? (
        <ul className={styles.dayIdeasList}>
          {rows.map((row) => {
            const editing = editingId === row.id;
            const unread = isDayIdeaUnread(row, spContext, members);
            const manageable = canManageRow(row);
            const authorLabel = formatDayIdeaAuthor(row, members);
            return (
              <li
                key={row.id}
                className={`${styles.dayIdeaRow} ${row.isComplete ? styles.dayIdeaDone : ''} ${unread ? styles.dayIdeaUnread : ''}`}
              >
                <input
                  className={styles.dayIdeaCheck}
                  type="checkbox"
                  checked={row.isComplete}
                  disabled={!canContribute}
                  aria-label={row.isComplete ? 'Mark as open idea' : 'Mark idea as agreed'}
                  onChange={() => {
                    const svc = new ReminderService(spContext);
                    void svc.update(row.id, { isComplete: !row.isComplete }).then(() => {
                      refresh();
                      notifyDayIdeasChanged();
                    });
                  }}
                />
                <div className={styles.dayIdeaBody}>
                  {editing ? (
                    <textarea
                      className={`${styles.dayIdeaInput} ${styles.dayIdeaTextarea}`}
                      value={editText}
                      onChange={(e) => setEditText(e.target.value)}
                      aria-label="Edit idea"
                      rows={3}
                    />
                  ) : (
                    <div className={styles.dayIdeaTextRow}>
                      <p className={styles.dayIdeaText}>{row.reminderText || row.title}</p>
                      {unread ? <span className={styles.dayIdeaItemBadge}>New</span> : null}
                    </div>
                  )}
                  <p className={styles.dayIdeaMeta}>
                    {authorLabel ? `${authorLabel} · ` : ''}
                    {formatDayIdeaStamp(row.dueDate)}
                  </p>
                  <DayIdeaReplies
                    row={row}
                    spContext={spContext}
                    members={members}
                    canContribute={canContribute}
                    canEditItinerary={canEditItinerary}
                    onUpdated={refresh}
                    compact
                  />
                </div>
                {manageable ? (
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
                              notifyDayIdeasChanged();
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
      {canContribute ? (
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
