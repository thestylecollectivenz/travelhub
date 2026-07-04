import * as React from 'react';
import { useTripWorkspace } from '../../context/TripWorkspaceContext';
import { localTodayYmd, matchesTaskDueFilter } from '../../utils/taskDueBuckets';
import { ReminderService, type TripReminder } from '../../services/ReminderService';
import { useSpContext } from '../../context/SpContext';
import { usePlanView } from '../../context/PlanViewContext';
import { requestInsightFocus } from '../../utils/insightFocus';
import { countMissingAmountRows } from '../../utils/missingAmountEntries';
import styles from './RightPaneInsights.module.css';

export const RightPaneTasksInsights: React.FC = () => {
  const { trip, localEntries } = useTripWorkspace();
  const spContext = useSpContext();
  const planView = usePlanView();
  const [reminders, setReminders] = React.useState<TripReminder[]>([]);
  const [activeFocus, setActiveFocus] = React.useState<string | null>(null);
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
    const missingCost = countMissingAmountRows(entries);
    const needsBooking = entries.filter((e) => e.bookingRequired && e.bookingStatus !== 'Booked').length;
    const unpaid = entries.filter(
      (e) => e.paymentStatus !== 'Fully paid' && e.paymentStatus !== 'Free' && (e.amount ?? 0) > 0
    ).length;

    return { overdue, dueToday, dueTomorrow, noAssignee, missingCost, needsBooking, unpaid, openCount: open.length };
  }, [reminders, todayYmd, trip, localEntries]);

  const focus = (key: string, action?: () => void): void => {
    setActiveFocus(key);
    requestInsightFocus('tasks', key);
    action?.();
  };

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
      <p className={styles.muted}>Click a row to filter the main list.</p>
      <ul className={styles.list}>
        {insights.overdue > 0 ? (
          <li>
            <button
              type="button"
              className={`${styles.listItem} ${styles.clickableItem} ${styles.warnItem} ${activeFocus === 'overdue' ? styles.clickableItemActive : ''}`}
              onClick={() => focus('overdue', () => {
                planView?.setPlanTab('tasks');
                planView?.setTaskSectionFilter('todo');
              })}
            >
              {insights.overdue} overdue task{insights.overdue === 1 ? '' : 's'}
            </button>
          </li>
        ) : null}
        {insights.noAssignee > 0 ? (
          <li>
            <button
              type="button"
              className={`${styles.listItem} ${styles.clickableItem} ${activeFocus === 'no_assignee' ? styles.clickableItemActive : ''}`}
              onClick={() => focus('no_assignee', () => planView?.setPlanTab('tasks'))}
            >
              {insights.noAssignee} open task{insights.noAssignee === 1 ? '' : 's'} without assignee
            </button>
          </li>
        ) : null}
        {insights.missingCost > 0 ? (
          <li>
            <button
              type="button"
              className={`${styles.listItem} ${styles.clickableItem} ${styles.warnItem} ${activeFocus === 'missing_cost' ? styles.clickableItemActive : ''}`}
              onClick={() => focus('missing_cost', () => planView?.setPlanTab('missing_costs'))}
            >
              {insights.missingCost} item{insights.missingCost === 1 ? '' : 's'} with no cost
            </button>
          </li>
        ) : null}
        {insights.needsBooking > 0 ? (
          <li>
            <button
              type="button"
              className={`${styles.listItem} ${styles.clickableItem} ${activeFocus === 'needs_booking' ? styles.clickableItemActive : ''}`}
              onClick={() => focus('needs_booking', () => {
                planView?.setPlanTab('tasks');
                planView?.setTaskSectionFilter('bookings');
              })}
            >
              {insights.needsBooking} item{insights.needsBooking === 1 ? '' : 's'} need booking
            </button>
          </li>
        ) : null}
        {insights.unpaid > 0 ? (
          <li>
            <button
              type="button"
              className={`${styles.listItem} ${styles.clickableItem} ${activeFocus === 'unpaid' ? styles.clickableItemActive : ''}`}
              onClick={() => focus('unpaid', () => {
                planView?.setPlanTab('tasks');
                planView?.setTaskSectionFilter('payments');
              })}
            >
              {insights.unpaid} unpaid item{insights.unpaid === 1 ? '' : 's'}
            </button>
          </li>
        ) : null}
        {insights.noAssignee === 0 && insights.missingCost === 0 && insights.needsBooking === 0 && insights.unpaid === 0 && insights.overdue === 0 ? (
          <li className={styles.muted}>No exceptions flagged.</li>
        ) : null}
      </ul>
    </section>
  );
};
