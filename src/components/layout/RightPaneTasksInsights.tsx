import * as React from 'react';
import { useTripWorkspace } from '../../context/TripWorkspaceContext';
import { localTodayYmd, matchesTaskDueFilter } from '../../utils/taskDueBuckets';
import { ReminderService, type TripReminder } from '../../services/ReminderService';
import { useSpContext } from '../../context/SpContext';
import styles from './RightPaneInsights.module.css';

export const RightPaneTasksInsights: React.FC = () => {
  const { trip, localEntries } = useTripWorkspace();
  const spContext = useSpContext();
  const [reminders, setReminders] = React.useState<TripReminder[]>([]);
  const todayYmd = React.useMemo(() => localTodayYmd(), []);

  React.useEffect(() => {
    if (!trip?.id) return;
    const svc = new ReminderService(spContext);
    svc.getForTrip(trip.id).then(setReminders).catch(console.error);
  }, [trip?.id, spContext]);

  const insights = React.useMemo(() => {
    const open = reminders.filter((r) => !r.isComplete);
    const overdue = open.filter((r) => matchesTaskDueFilter(r.dueDate, 'overdue', todayYmd)).length;
    const dueToday = open.filter((r) => matchesTaskDueFilter(r.dueDate, 'today', todayYmd)).length;
    const dueTomorrow = open.filter((r) => matchesTaskDueFilter(r.dueDate, 'tomorrow', todayYmd)).length;
    const noAssignee = open.filter((r) => !(r.assignedTo || '').trim()).length;

    const entries = trip ? localEntries.filter((e) => e.tripId === trip.id) : [];
    const missingCost = entries.filter((e) => !e.parentEntryId && (e.amount ?? 0) <= 0 && e.category !== 'Location info').length;
    const needsBooking = entries.filter((e) => e.bookingRequired && e.bookingStatus !== 'Booked').length;
    const unpaid = entries.filter(
      (e) => e.paymentStatus !== 'Fully paid' && e.paymentStatus !== 'Free' && (e.amount ?? 0) > 0
    ).length;

    return { overdue, dueToday, dueTomorrow, noAssignee, missingCost, needsBooking, unpaid, openCount: open.length };
  }, [reminders, todayYmd, trip, localEntries]);

  return (
    <section className={styles.root} aria-label="Tasks review">
      <h2 className={styles.heading}>Tasks review</h2>
      <div className={styles.statGrid}>
        <div className={styles.stat}>
          <span className={styles.statValue}>{insights.openCount}</span>
          <span className={styles.statLabel}>Open tasks</span>
        </div>
        <div className={styles.stat}>
          <span className={styles.statValue}>{insights.overdue}</span>
          <span className={styles.statLabel}>Overdue</span>
        </div>
        <div className={styles.stat}>
          <span className={styles.statValue}>{insights.dueToday}</span>
          <span className={styles.statLabel}>Due today</span>
        </div>
        <div className={styles.stat}>
          <span className={styles.statValue}>{insights.dueTomorrow}</span>
          <span className={styles.statLabel}>Due tomorrow</span>
        </div>
      </div>
      <h3 className={styles.subheading}>Exceptions</h3>
      <ul className={styles.list}>
        {insights.noAssignee > 0 ? (
          <li className={styles.listItem}>{insights.noAssignee} open task{insights.noAssignee === 1 ? '' : 's'} without assignee</li>
        ) : null}
        {insights.missingCost > 0 ? (
          <li className={`${styles.listItem} ${styles.warnItem}`}>
            {insights.missingCost} itinerary card{insights.missingCost === 1 ? '' : 's'} with no cost
          </li>
        ) : null}
        {insights.needsBooking > 0 ? (
          <li className={styles.listItem}>{insights.needsBooking} item{insights.needsBooking === 1 ? '' : 's'} need booking</li>
        ) : null}
        {insights.unpaid > 0 ? (
          <li className={styles.listItem}>{insights.unpaid} unpaid item{insights.unpaid === 1 ? '' : 's'}</li>
        ) : null}
        {insights.noAssignee === 0 && insights.missingCost === 0 && insights.needsBooking === 0 && insights.unpaid === 0 ? (
          <li className={styles.muted}>No exceptions flagged.</li>
        ) : null}
      </ul>
    </section>
  );
};
