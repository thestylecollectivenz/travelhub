import * as React from 'react';
import type { ItineraryEntry } from '../../models/ItineraryEntry';
import { useTripWorkspace } from '../../context/TripWorkspaceContext';
import { useSpContext } from '../../context/SpContext';
import { ReminderService, TripReminder } from '../../services/ReminderService';
import { requestSidebarDayFocus } from '../../utils/sidebarDayFocus';
import styles from './TripTasksView.module.css';

type TaskFilter = 'incomplete' | 'all' | 'missing_amounts';

function entryAmountMissing(amount: number | undefined): boolean {
  if (amount === undefined || amount === null) return true;
  if (typeof amount !== 'number' || Number.isNaN(amount)) return true;
  return amount <= 0;
}

/** Map reminder EntryId (parent row or sub-item row) to parent entry + day for deep-linking. */
function resolveReminderItineraryTarget(
  m: TripReminder,
  localEntries: ItineraryEntry[]
): { openEntryId: string; openDayId: string; contextLine: string } | undefined {
  const eid = (m.entryId || '').trim();
  if (!eid) return undefined;
  const parent = localEntries.find((e) => e.id === eid);
  if (parent) {
    return {
      openEntryId: parent.id,
      openDayId: parent.dayId,
      contextLine: `${parent.category ? `${parent.category} · ` : ''}${parent.title || 'Untitled'}`
    };
  }
  for (const p of localEntries) {
    const sub = p.subItems?.find((s) => s.id === eid);
    if (sub) {
      return {
        openEntryId: p.id,
        openDayId: p.dayId,
        contextLine: `Option: ${sub.title || 'Untitled'} · under ${p.title || 'Item'}`
      };
    }
  }
  return undefined;
}

export const TripTasksView: React.FC = () => {
  const spContext = useSpContext();
  const { trip, localEntries, tripDays, updateEntry, setSelectedDayId, setEditingCardId, setMainWorkspaceTab } = useTripWorkspace();
  const [manual, setManual] = React.useState<TripReminder[]>([]);
  const [filter, setFilter] = React.useState<TaskFilter>('incomplete');
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

  const bookingTasks = React.useMemo(() => localEntries.filter((e) => e.bookingRequired && e.bookingStatus === 'Not booked'), [localEntries]);
  const paymentTasks = React.useMemo(() => localEntries.filter((e) => (e.paymentStatus === 'Not paid' && e.amount > 0) || e.paymentStatus === 'Part paid'), [localEntries]);
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

  const openEntryInItinerary = React.useCallback(
    (entryId: string, dayId: string): void => {
      setMainWorkspaceTab('itinerary');
      setSelectedDayId(dayId);
      setEditingCardId(entryId);
      requestSidebarDayFocus(dayId);
    },
    [setEditingCardId, setMainWorkspaceTab, setSelectedDayId]
  );

  const showStandardSections = filter !== 'missing_amounts';

  return (
    <section className={styles.root}>
      <div className={styles.filters}>
        <h2 className={styles.title}>Tasks</h2>
        <select className={styles.select} value={filter} onChange={(e) => setFilter(e.target.value as TaskFilter)}>
          <option value="incomplete">Incomplete only</option>
          <option value="all">All</option>
          <option value="missing_amounts">Missing amounts (itinerary)</option>
        </select>
      </div>

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
                <div>
                  <div className={styles.missingTitle}>{entry.title || 'Untitled'}</div>
                  <div className={styles.meta}>
                    {entry.category ? `${entry.category} · ` : null}
                    {dayName(entry.dayId) || 'Day'}
                  </div>
                  <div className={styles.meta}>Amount: {entry.amount === 0 ? '0' : '—'}</div>
                </div>
                <div className={styles.actions}>
                  <button
                    className={styles.button}
                    type="button"
                    onClick={() => openEntryInItinerary(entry.id, entry.dayId)}
                  >
                    Open in itinerary
                  </button>
                </div>
              </div>
            ))
          )}
        </div>
      ) : null}

      {showStandardSections ? (
        <>
          <div className={styles.group}>
            <h3 className={styles.title}>Reminders &amp; tasks</h3>
            <div className={styles.filters}>
              <input className={styles.input} placeholder="Reminder text" value={text} onChange={(e) => setText(e.target.value)} />
              <input className={styles.input} type="date" value={dueDate} onChange={(e) => setDueDate(e.target.value)} />
              <button
                className={styles.button}
                type="button"
                onClick={() => {
                  if (!trip?.id || !text.trim()) return;
                  svc
                    .create({
                      title: text.trim(),
                      tripId: trip.id,
                      reminderType: 'Custom',
                      reminderText: text.trim(),
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
                Add
              </button>
            </div>
            {visibleManual.map((m) => {
              const target = resolveReminderItineraryTarget(m, localEntries);
              return (
                <div key={m.id} className={styles.item}>
                  <div>
                    <div>{m.title}</div>
                    <div className={styles.meta}>
                      {m.reminderType ? <span>Type: {m.reminderType}</span> : null}
                      {m.reminderType ? <span aria-hidden> · </span> : null}
                      {m.dueDate ? `Due ${new Date(m.dueDate).toLocaleDateString('en-NZ')}` : 'No due date'}
                    </div>
                    {m.taskNote?.trim() ? <div className={styles.meta}>Note: {m.taskNote.trim()}</div> : null}
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
                      <button
                        className={styles.button}
                        type="button"
                        onClick={() => openEntryInItinerary(target.openEntryId, target.openDayId)}
                      >
                        Open in itinerary
                      </button>
                    ) : null}
                    <button
                      className={styles.button}
                      type="button"
                      onClick={() => svc.update(m.id, { isComplete: !m.isComplete }).then(refresh).catch(console.error)}
                    >
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
                <div>
                  <div>Book: {entry.title}</div>
                  <div className={styles.meta}>{dayName(entry.dayId)}</div>
                </div>
                <div className={styles.actions}>
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
                <div>
                  <div>
                    {entry.paymentStatus === 'Part paid' ? `Pay balance: ${entry.title}` : `Pay: ${entry.title}`} (
                    {Math.max(0, entry.amount - (entry.amountPaid || 0)).toFixed(2)})
                  </div>
                  <div className={styles.meta}>{dayName(entry.dayId)}</div>
                </div>
                <div className={styles.actions}>
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
