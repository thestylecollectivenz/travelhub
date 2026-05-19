import * as React from 'react';
import type { ItineraryEntry } from '../../models/ItineraryEntry';
import { useTripWorkspace } from '../../context/TripWorkspaceContext';
import { useSpContext } from '../../context/SpContext';
import { ReminderService, TripReminder } from '../../services/ReminderService';
import { requestSidebarDayFocus } from '../../utils/sidebarDayFocus';
import { itineraryNotesPreview } from '../../utils/taskNotePreview';
import { TasksCalendarView, type CalendarEvent, type CalendarRangeFilter } from './TasksCalendarView';
import styles from './TripTasksView.module.css';

type TaskFilter = 'incomplete' | 'all' | 'missing_amounts';
type CreateKind = 'task' | 'reminder';
type ViewMode = 'list' | 'calendar';

function entryAmountMissing(amount: number | undefined): boolean {
  if (amount === undefined || amount === null) return true;
  if (typeof amount !== 'number' || Number.isNaN(amount)) return true;
  return amount <= 0;
}

function stripFollowUpPrefix(text: string): string {
  return text.replace(/^Follow\s*up:\s*/i, '').trim();
}

function reminderDisplayTitle(m: TripReminder): string {
  const isManual = m.reminderType === 'Manual' || m.reminderType === 'ManualEntryTask';
  const isReminder = m.reminderType === 'Custom' || m.reminderType === 'CancellationDeadline';
  if (isManual) {
    let raw = stripFollowUpPrefix((m.reminderText || m.title || '').trim());
    if (!raw) return 'Task';
    return raw.startsWith('Task:') ? raw : `Task: ${raw}`;
  }
  if (isReminder) {
    const raw = (m.reminderText || m.title || '').trim();
    if (!raw) return 'Reminder';
    return raw.startsWith('Reminder:') ? raw : `Reminder: ${raw}`;
  }
  return m.title;
}

function resolveReminderItineraryTarget(
  m: TripReminder,
  localEntries: ItineraryEntry[]
): { openEntryId: string; openDayId: string; contextLine: string; entry?: ItineraryEntry } | undefined {
  const eid = (m.entryId || '').trim();
  if (!eid) return undefined;
  const parent = localEntries.find((e) => e.id === eid);
  if (parent) {
    return {
      openEntryId: parent.id,
      openDayId: parent.dayId,
      contextLine: `${parent.category ? `${parent.category} · ` : ''}${parent.title || 'Untitled'}`,
      entry: parent
    };
  }
  for (const p of localEntries) {
    const sub = p.subItems?.find((s) => s.id === eid);
    if (sub) {
      return {
        openEntryId: p.id,
        openDayId: p.dayId,
        contextLine: `Option: ${sub.title || 'Untitled'} · under ${p.title || 'Item'}`,
        entry: p
      };
    }
  }
  return undefined;
}

function ymdFromIso(iso?: string): string {
  return (iso || '').slice(0, 10);
}

export const TripTasksView: React.FC = () => {
  const spContext = useSpContext();
  const { trip, localEntries, tripDays, updateEntry, setSelectedDayId, setEditingCardId, setFocusedEntryId, setMainWorkspaceTab } =
    useTripWorkspace();
  const [manual, setManual] = React.useState<TripReminder[]>([]);
  const [filter, setFilter] = React.useState<TaskFilter>('incomplete');
  const [viewMode, setViewMode] = React.useState<ViewMode>('list');
  const [calendarRange, setCalendarRange] = React.useState<CalendarRangeFilter>('this_month');
  const [createKind, setCreateKind] = React.useState<CreateKind>('task');
  const [text, setText] = React.useState('');
  const [dueDate, setDueDate] = React.useState('');

  const svc = React.useMemo(() => new ReminderService(spContext), [spContext]);

  const refresh = React.useCallback(() => {
    if (!trip?.id) return;
    svc.getForTrip(trip.id).then(setManual).catch(console.error);
  }, [svc, trip?.id]);

  React.useEffect(() => {
    refresh();
  }, [refresh]);

  const bookingTasks = React.useMemo(
    () => localEntries.filter((e) => e.bookingRequired && e.bookingStatus === 'Not booked'),
    [localEntries]
  );
  const paymentTasks = React.useMemo(
    () => localEntries.filter((e) => (e.paymentStatus === 'Not paid' && e.amount > 0) || e.paymentStatus === 'Part paid'),
    [localEntries]
  );
  const visibleManual = React.useMemo(() => {
    if (filter === 'all') return manual;
    if (filter === 'incomplete') return manual.filter((m) => !m.isComplete);
    return manual;
  }, [manual, filter]);

  const missingAmountEntries = React.useMemo(() => {
    return localEntries
      .filter((e) => entryAmountMissing(e.amount))
      .sort((a, b) => {
        const da = tripDays.find((d) => d.id === a.dayId)?.dayNumber ?? 0;
        const db = tripDays.find((d) => d.id === b.dayId)?.dayNumber ?? 0;
        if (da !== db) return da - db;
        return (a.title || '').localeCompare(b.title || '');
      });
  }, [localEntries, tripDays]);

  const dayName = React.useCallback((dayId?: string) => tripDays.find((d) => d.id === dayId)?.displayTitle || '', [tripDays]);

  const openEntryInItineraryRead = React.useCallback(
    (entryId: string, dayId: string): void => {
      setMainWorkspaceTab('itinerary');
      setSelectedDayId(dayId);
      setEditingCardId(null);
      setFocusedEntryId(entryId);
      requestSidebarDayFocus(dayId);
    },
    [setEditingCardId, setFocusedEntryId, setMainWorkspaceTab, setSelectedDayId]
  );

  const calendarEvents = React.useMemo((): CalendarEvent[] => {
    const out: CalendarEvent[] = [];
    for (const m of manual.filter((x) => !x.isComplete && x.dueDate)) {
      const date = ymdFromIso(m.dueDate);
      if (!date) continue;
      out.push({
        id: `rem-${m.id}`,
        date,
        title: reminderDisplayTitle(m),
        kind: m.reminderType === 'Custom' || m.reminderType === 'CancellationDeadline' ? 'reminder' : 'task',
        entryId: m.entryId,
        dayId: m.dayId
      });
    }
    for (const e of bookingTasks) {
      if (e.bookingDueDate) {
        out.push({
          id: `book-${e.id}`,
          date: e.bookingDueDate,
          title: `Book: ${e.title || 'Untitled'}`,
          kind: 'booking',
          entryId: e.id,
          dayId: e.dayId
        });
      }
    }
    for (const e of paymentTasks) {
      if (e.paymentDueDate) {
        out.push({
          id: `pay-${e.id}`,
          date: e.paymentDueDate,
          title: `Pay: ${e.title || 'Untitled'}`,
          kind: 'payment',
          entryId: e.id,
          dayId: e.dayId
        });
      }
    }
    return out;
  }, [manual, bookingTasks, paymentTasks]);

  const showStandardSections = filter !== 'missing_amounts';

  const renderItineraryNote = (entry: ItineraryEntry | undefined): React.ReactNode => {
    if (!entry?.notes?.trim()) return null;
    const { preview, truncated } = itineraryNotesPreview(entry.notes);
    if (!preview) return null;
    return (
      <div className={styles.noteBlock}>
        <span className={styles.noteLabel}>Note: </span>
        <span className={styles.noteText}>{preview}</span>
        {truncated ? (
          <>
            <span> … </span>
            <button type="button" className={styles.noteExpand} onClick={() => openEntryInItineraryRead(entry.id, entry.dayId)}>
              more
            </button>
          </>
        ) : null}
      </div>
    );
  };

  return (
    <section className={styles.root}>
      <div className={styles.filters}>
        <h2 className={styles.title}>Tasks &amp; reminders</h2>
        <select className={styles.select} value={filter} onChange={(e) => setFilter(e.target.value as TaskFilter)}>
          <option value="incomplete">Incomplete only</option>
          <option value="all">All</option>
          <option value="missing_amounts">Missing amounts (itinerary)</option>
        </select>
        <select className={styles.select} value={viewMode} onChange={(e) => setViewMode(e.target.value as ViewMode)}>
          <option value="list">List</option>
          <option value="calendar">Calendar</option>
        </select>
        {viewMode === 'calendar' ? (
          <select className={styles.select} value={calendarRange} onChange={(e) => setCalendarRange(e.target.value as CalendarRangeFilter)}>
            <option value="this_week">This week</option>
            <option value="this_month">This month</option>
            <option value="next_week">Next week</option>
            <option value="next_month">Next month</option>
            <option value="all">All dates</option>
          </select>
        ) : null}
      </div>

      {viewMode === 'calendar' && showStandardSections ? (
        <TasksCalendarView events={calendarEvents} rangeFilter={calendarRange} onOpenEntry={openEntryInItineraryRead} />
      ) : null}

      {filter === 'missing_amounts' ? (
        <div className={styles.group}>
          <h3 className={styles.title}>Itinerary items with no cost entered</h3>
          <p className={styles.hint}>Items where the main amount is zero or blank. Open an item in the itinerary to add a cost.</p>
          {missingAmountEntries.length === 0 ? (
            <div className={styles.meta} role="status">
              No items missing amounts.
            </div>
          ) : (
            missingAmountEntries.map((entry) => (
              <div key={entry.id} className={styles.item}>
                <div className={styles.itemBody}>
                  <div className={styles.missingTitle}>{entry.title || 'Untitled'}</div>
                  <div className={styles.meta}>
                    {entry.category ? `${entry.category} · ` : null}
                    {dayName(entry.dayId) || 'Day'}
                  </div>
                </div>
                <div className={styles.actions}>
                  <button className={styles.button} type="button" onClick={() => openEntryInItineraryRead(entry.id, entry.dayId)}>
                    Open in itinerary
                  </button>
                </div>
              </div>
            ))
          )}
        </div>
      ) : null}

      {viewMode === 'list' && showStandardSections ? (
        <>
          <div className={styles.group}>
            <h3 className={styles.title}>Add new</h3>
            <div className={styles.filters}>
              <select className={styles.select} value={createKind} onChange={(e) => setCreateKind(e.target.value as CreateKind)}>
                <option value="task">Task</option>
                <option value="reminder">Reminder</option>
              </select>
              <input
                className={styles.input}
                placeholder={createKind === 'task' ? 'Task description' : 'Reminder text'}
                value={text}
                onChange={(e) => setText(e.target.value)}
              />
              <input className={styles.input} type="date" value={dueDate} onChange={(e) => setDueDate(e.target.value)} />
              <button
                className={styles.button}
                type="button"
                onClick={() => {
                  if (!trip?.id || !text.trim()) return;
                  const trimmed = text.trim();
                  const title =
                    createKind === 'task'
                      ? trimmed.startsWith('Task:')
                        ? trimmed
                        : `Task: ${trimmed}`
                      : trimmed.startsWith('Reminder:')
                        ? trimmed
                        : `Reminder: ${trimmed}`;
                  svc
                    .create({
                      title,
                      tripId: trip.id,
                      reminderType: createKind === 'task' ? 'Manual' : 'Custom',
                      reminderText: trimmed,
                      isComplete: false,
                      dueDate: dueDate ? `${dueDate}T00:00:00.000Z` : undefined,
                      dayId: '',
                      entryId: ''
                    })
                    .then(() => {
                      setText('');
                      setDueDate('');
                      refresh();
                    })
                    .catch(console.error);
                }}
              >
                Add {createKind === 'task' ? 'task' : 'reminder'}
              </button>
            </div>
            {visibleManual.map((m) => {
              const target = resolveReminderItineraryTarget(m, localEntries);
              return (
                <div key={m.id} className={styles.item}>
                  <div className={styles.itemBody}>
                    <div>{reminderDisplayTitle(m)}</div>
                    <div className={styles.meta}>
                      {m.dueDate ? `Due ${new Date(m.dueDate).toLocaleDateString('en-NZ')}` : 'No due date'}
                    </div>
                    {renderItineraryNote(target?.entry)}
                    {target ? (
                      <div className={styles.meta}>
                        {target.contextLine}
                        <span aria-hidden> · </span>
                        {dayName(target.openDayId) || 'Itinerary day'}
                      </div>
                    ) : null}
                  </div>
                  <div className={styles.actions}>
                    {target ? (
                      <button className={styles.button} type="button" onClick={() => openEntryInItineraryRead(target.openEntryId, target.openDayId)}>
                        Open in itinerary
                      </button>
                    ) : null}
                    <button className={styles.button} type="button" onClick={() => svc.update(m.id, { isComplete: !m.isComplete }).then(refresh).catch(console.error)}>
                      {m.isComplete ? 'Mark incomplete' : 'Complete'}
                    </button>
                    <button className={styles.button} type="button" onClick={() => svc.delete(m.id).then(refresh).catch(console.error)}>
                      Delete
                    </button>
                  </div>
                </div>
              );
            })}
          </div>

          <div className={styles.group}>
            <h3 className={styles.title}>Bookings needed</h3>
            {bookingTasks.map((entry) => (
              <div key={entry.id} className={styles.item}>
                <div className={styles.itemBody}>
                  <div>Book: {entry.title}</div>
                  <div className={styles.meta}>{dayName(entry.dayId)}</div>
                  <label className={styles.dueLabel}>
                    Book by{' '}
                    <input
                      className={styles.input}
                      type="date"
                      value={entry.bookingDueDate?.slice(0, 10) || ''}
                      onChange={(e) => updateEntry({ ...entry, bookingDueDate: e.target.value || undefined })}
                    />
                  </label>
                </div>
                <div className={styles.actions}>
                  <button className={styles.button} type="button" onClick={() => openEntryInItineraryRead(entry.id, entry.dayId)}>
                    Open in itinerary
                  </button>
                  <button className={styles.button} type="button" onClick={() => updateEntry({ ...entry, bookingStatus: 'Booked' })}>
                    Mark done
                  </button>
                </div>
              </div>
            ))}
          </div>

          <div className={styles.group}>
            <h3 className={styles.title}>Payments due</h3>
            {paymentTasks.map((entry) => (
              <div key={entry.id} className={styles.item}>
                <div className={styles.itemBody}>
                  <div>
                    {entry.paymentStatus === 'Part paid' ? `Pay balance: ${entry.title}` : `Pay: ${entry.title}`} (
                    {Math.max(0, entry.amount - (entry.amountPaid || 0)).toFixed(2)})
                  </div>
                  <div className={styles.meta}>{dayName(entry.dayId)}</div>
                  <label className={styles.dueLabel}>
                    Pay by{' '}
                    <input
                      className={styles.input}
                      type="date"
                      value={entry.paymentDueDate?.slice(0, 10) || ''}
                      onChange={(e) => updateEntry({ ...entry, paymentDueDate: e.target.value || undefined })}
                    />
                  </label>
                </div>
                <div className={styles.actions}>
                  <button className={styles.button} type="button" onClick={() => openEntryInItineraryRead(entry.id, entry.dayId)}>
                    Open in itinerary
                  </button>
                  <button
                    className={styles.button}
                    type="button"
                    onClick={() => updateEntry({ ...entry, paymentStatus: 'Fully paid', amountPaid: entry.amount })}
                  >
                    Mark done
                  </button>
                </div>
              </div>
            ))}
          </div>
        </>
      ) : null}
    </section>
  );
};

