import type { WebPartContext } from '@microsoft/sp-webpart-base';
import * as React from 'react';
import type { TripDay } from '../../models/TripDay';
import type { TripMember } from '../../models/TripMember';
import type { TripReminder } from '../../services/ReminderService';
import { useSpContext } from '../../context/SpContext';
import { useTripWorkspace } from '../../context/TripWorkspaceContext';
import { useTripMembers } from '../../hooks/useTripMembers';
import { useTripPermissions } from '../../hooks/useTripPermissions';
import { useTripRole } from '../../context/TripRoleContext';
import { ReminderService } from '../../services/ReminderService';
import { confirmUserAction } from '../../utils/confirmAction';
import {
  buildDayIdeaMetaForCreate,
  formatDayIdeaAuthor,
  formatDayIdeaStamp,
  isDayIdeaAuthor,
  isDayIdeaUnread,
  matchesDayIdeaStatus,
  type DayIdeaStatusFilter
} from '../../utils/dayIdeas';
import { travellerLabelForCurrentUser } from '../../utils/tripMemberIdentity';
import { notifyDayIdeasChanged } from '../../hooks/useTripDayIdeas';
import styles from './TripDayIdeasView.module.css';

export interface TripDayIdeasViewProps {
  ideas: TripReminder[];
  unreadCount: number;
  mobileLayout?: boolean;
  onMarkAllRead?: () => void | Promise<void>;
  onMarkRead?: (id: string) => void | Promise<void>;
  onGoToDay?: (dayId: string) => void;
  onRefresh?: () => void;
}

function dayLabel(day: TripDay | undefined): string {
  if (!day) return 'Day';
  const date = (day.calendarDate || '').slice(0, 10);
  const title = (day.displayTitle || '').trim();
  if (title && date) return `${title} · ${date}`;
  return title || date || 'Day';
}

export const TripDayIdeasView: React.FC<TripDayIdeasViewProps> = ({
  ideas,
  unreadCount,
  mobileLayout = false,
  onMarkAllRead,
  onMarkRead,
  onGoToDay,
  onRefresh
}) => {
  const spContext = useSpContext();
  const { trip, tripDays } = useTripWorkspace();
  const { members } = useTripMembers(trip?.id);
  const { role } = useTripRole();
  const { canEditItinerary } = useTripPermissions();
  const canContribute = role === 'Editor' || role === 'Companion';

  const [status, setStatus] = React.useState<DayIdeaStatusFilter>('all');
  const [editingId, setEditingId] = React.useState<string | null>(null);
  const [editText, setEditText] = React.useState('');

  const dayById = React.useMemo(() => {
    const map = new Map<string, TripDay>();
    for (const d of tripDays) map.set(d.id, d);
    return map;
  }, [tripDays]);

  const filtered = React.useMemo(
    () => ideas.filter((r) => matchesDayIdeaStatus(r, status)),
    [ideas, status]
  );

  const grouped = React.useMemo(() => {
    const map = new Map<string, TripReminder[]>();
    for (const row of filtered) {
      const key = row.dayId || '__none__';
      const list = map.get(key) ?? [];
      list.push(row);
      map.set(key, list);
    }
    const keys = Array.from(map.keys()).sort((a, b) => {
      const da = dayById.get(a)?.dayNumber ?? 9999;
      const db = dayById.get(b)?.dayNumber ?? 9999;
      return da - db;
    });
    return keys.map((key) => ({ dayId: key, rows: map.get(key) ?? [] }));
  }, [filtered, dayById]);

  const canManageRow = React.useCallback(
    (row: TripReminder): boolean => {
      if (canEditItinerary) return true;
      return isDayIdeaAuthor(row, spContext, members);
    },
    [canEditItinerary, spContext, members]
  );

  const toggleComplete = async (row: TripReminder): Promise<void> => {
    const svc = new ReminderService(spContext);
    await svc.update(row.id, { isComplete: !row.isComplete });
    onRefresh?.();
    notifyDayIdeasChanged();
  };

  const saveEdit = async (row: TripReminder): Promise<void> => {
    const text = editText.trim();
    if (!text) return;
    const svc = new ReminderService(spContext);
    await svc.update(row.id, { title: text, reminderText: text });
    setEditingId(null);
    setEditText('');
    onRefresh?.();
    notifyDayIdeasChanged();
  };

  const deleteRow = async (row: TripReminder): Promise<void> => {
    if (!(await confirmUserAction('Delete this idea?'))) return;
    const svc = new ReminderService(spContext);
    await svc.delete(row.id);
    onRefresh?.();
    notifyDayIdeasChanged();
  };

  const rootClass = mobileLayout ? `${styles.root} ${styles.mobileRoot}` : styles.root;

  return (
    <div className={rootClass}>
      <div className={styles.head}>
        <div>
          <h2 className={styles.title}>Trip ideas</h2>
          <p className={styles.sub}>All day ideas from editors and companions in one place.</p>
        </div>
        {unreadCount > 0 && onMarkAllRead ? (
          <button type="button" className={styles.markAllBtn} onClick={() => void onMarkAllRead()}>
            Mark {unreadCount} as read
          </button>
        ) : null}
      </div>

      <div className={styles.filters} role="group" aria-label="Filter ideas">
        {(['all', 'open', 'agreed'] as const).map((key) => (
          <button
            key={key}
            type="button"
            className={status === key ? styles.filterOn : styles.filter}
            onClick={() => setStatus(key)}
          >
            {key === 'all' ? 'All' : key === 'open' ? 'Open' : 'Agreed'}
          </button>
        ))}
      </div>

      {!filtered.length ? (
        <p className={styles.empty}>No ideas match this filter yet.</p>
      ) : (
        grouped.map((group) => {
          const day = dayById.get(group.dayId);
          const groupUnread = group.rows.filter((r) => isDayIdeaUnread(r, spContext, members)).length;
          return (
            <section key={group.dayId} className={styles.dayGroup}>
              <div className={styles.dayHead}>
                <button
                  type="button"
                  className={styles.dayTitleBtn}
                  onClick={() => {
                    if (group.dayId !== '__none__' && onGoToDay) onGoToDay(group.dayId);
                  }}
                  disabled={group.dayId === '__none__' || !onGoToDay}
                >
                  {dayLabel(day)}
                </button>
                {groupUnread > 0 ? <span className={styles.groupBadge}>{groupUnread} new</span> : null}
              </div>
              <ul className={styles.list}>
                {group.rows.map((row) => {
                  const unread = isDayIdeaUnread(row, spContext, members);
                  const editing = editingId === row.id;
                  const manageable = canManageRow(row);
                  const authorLabel = formatDayIdeaAuthor(row, members);
                  return (
                    <li
                      key={row.id}
                      className={`${styles.row} ${row.isComplete ? styles.rowDone : ''} ${unread ? styles.rowUnread : ''}`}
                      onClick={() => {
                        if (unread && onMarkRead) void onMarkRead(row.id);
                      }}
                    >
                      <input
                        className={styles.check}
                        type="checkbox"
                        checked={row.isComplete}
                        disabled={!canContribute}
                        aria-label={row.isComplete ? 'Reopen idea' : 'Mark idea as agreed'}
                        onChange={() => void toggleComplete(row)}
                      />
                      <div className={styles.body}>
                        <div className={styles.titleRow}>
                          {editing ? (
                            <input
                              className={styles.input}
                              value={editText}
                              onChange={(e) => setEditText(e.target.value)}
                              aria-label="Edit idea"
                            />
                          ) : (
                            <p className={styles.text}>{row.reminderText || row.title}</p>
                          )}
                          {unread ? <span className={styles.newBadge}>New</span> : null}
                          {row.isComplete ? <span className={styles.agreedBadge}>Agreed</span> : null}
                        </div>
                        <p className={styles.meta}>
                          {authorLabel ? `${authorLabel} · ` : ''}
                          {formatDayIdeaStamp(row.dueDate)}
                        </p>
                      </div>
                      {manageable ? (
                        <div className={styles.actions}>
                          {editing ? (
                            <>
                              <button type="button" className={styles.actionBtn} onClick={() => void saveEdit(row)}>
                                Save
                              </button>
                              <button type="button" className={styles.actionBtn} onClick={() => setEditingId(null)}>
                                Cancel
                              </button>
                            </>
                          ) : (
                            <>
                              <button
                                type="button"
                                className={styles.actionBtn}
                                onClick={() => {
                                  setEditingId(row.id);
                                  setEditText(row.reminderText || row.title);
                                }}
                              >
                                Edit
                              </button>
                              <button type="button" className={styles.actionBtn} onClick={() => void deleteRow(row)}>
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
            </section>
          );
        })
      )}
    </div>
  );
};

export async function createDayIdea(
  spContext: WebPartContext,
  tripId: string,
  dayId: string,
  text: string,
  members?: TripMember[]
): Promise<void> {
  const svc = new ReminderService(spContext);
  await svc.create({
    title: text,
    tripId,
    dayId,
    reminderType: 'DayIdea',
    reminderText: text,
    taskNote: buildDayIdeaMetaForCreate(spContext),
    assignedTo: travellerLabelForCurrentUser(spContext, members),
    isComplete: false,
    dueDate: new Date().toISOString(),
    entryId: ''
  });
  notifyDayIdeasChanged();
}
