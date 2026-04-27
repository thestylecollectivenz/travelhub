import * as React from 'react';
import { useTripWorkspace } from '../../context/TripWorkspaceContext';
import { useSpContext } from '../../context/SpContext';
import { ReminderService, TripReminder } from '../../services/ReminderService';
import styles from './TripTasksView.module.css';

type TaskFilter = 'incomplete' | 'all';

export const TripTasksView: React.FC = () => {
  const spContext = useSpContext();
  const { trip, localEntries, tripDays, updateEntry } = useTripWorkspace();
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
  const visibleManual = React.useMemo(() => (filter === 'all' ? manual : manual.filter((m) => !m.isComplete)), [manual, filter]);

  const dayName = React.useCallback((dayId?: string) => tripDays.find((d) => d.id === dayId)?.displayTitle || '', [tripDays]);

  return (
    <section className={styles.root}>
      <div className={styles.filters}>
        <h2 className={styles.title}>Tasks</h2>
        <select className={styles.select} value={filter} onChange={(e) => setFilter(e.target.value as TaskFilter)}>
          <option value="incomplete">Incomplete only</option>
          <option value="all">All</option>
        </select>
      </div>

      <div className={styles.group}>
        <h3 className={styles.title}>Custom reminders</h3>
        <div className={styles.filters}>
          <input className={styles.input} placeholder="Reminder text" value={text} onChange={(e) => setText(e.target.value)} />
          <input className={styles.input} type="date" value={dueDate} onChange={(e) => setDueDate(e.target.value)} />
          <button className={styles.button} type="button" onClick={() => {
            if (!trip?.id || !text.trim()) return;
            svc.create({ title: text.trim(), tripId: trip.id, reminderType: 'Custom', reminderText: text.trim(), isComplete: false, dueDate: dueDate ? `${dueDate}T00:00:00.000Z` : undefined, dayId: '', entryId: '' }).then(() => {
              setText('');
              setDueDate('');
              refresh();
            }).catch(console.error);
          }}>Add</button>
        </div>
        {visibleManual.map((m) => (
          <div key={m.id} className={styles.item}>
            <div>
              <div>{m.title}</div>
              <div className={styles.meta}>{m.dueDate ? `Due ${new Date(m.dueDate).toLocaleDateString('en-NZ')}` : 'No due date'}</div>
            </div>
            <div className={styles.actions}>
              <button className={styles.button} type="button" onClick={() => svc.update(m.id, { isComplete: !m.isComplete }).then(refresh).catch(console.error)}>{m.isComplete ? 'Mark incomplete' : 'Complete'}</button>
              <button className={styles.button} type="button" onClick={() => svc.delete(m.id).then(refresh).catch(console.error)}>Delete</button>
            </div>
          </div>
        ))}
      </div>

      <div className={styles.group}>
        <h3 className={styles.title}>Bookings needed</h3>
        {bookingTasks.map((entry) => (
          <div key={entry.id} className={styles.item}>
            <div>
              <div>Book: {entry.title}</div>
              <div className={styles.meta}>{dayName(entry.dayId)}</div>
            </div>
            <div className={styles.actions}><button className={styles.button} type="button" onClick={() => updateEntry({ ...entry, bookingStatus: 'Booked' })}>Mark done</button></div>
          </div>
        ))}
      </div>

      <div className={styles.group}>
        <h3 className={styles.title}>Payments due</h3>
        {paymentTasks.map((entry) => (
          <div key={entry.id} className={styles.item}>
            <div>
              <div>{entry.paymentStatus === 'Part paid' ? `Pay balance: ${entry.title}` : `Pay: ${entry.title}`} ({Math.max(0, entry.amount - (entry.amountPaid || 0)).toFixed(2)})</div>
              <div className={styles.meta}>{dayName(entry.dayId)}</div>
            </div>
            <div className={styles.actions}><button className={styles.button} type="button" onClick={() => updateEntry({ ...entry, paymentStatus: 'Fully paid', amountPaid: entry.amount })}>Mark done</button></div>
          </div>
        ))}
      </div>
    </section>
  );
};
