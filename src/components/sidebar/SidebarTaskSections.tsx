import * as React from 'react';
import { useTripWorkspace } from '../../context/TripWorkspaceContext';
import { usePlanView, type TaskSectionKey } from '../../context/PlanViewContext';
import { useSpContext } from '../../context/SpContext';
import { ReminderService } from '../../services/ReminderService';
import { TASK_FILTER_UNCATEGORISED } from '../../utils/taskFilters';
import styles from './TripSidebar.module.css';

type SectionRow = {
  key: TaskSectionKey;
  label: string;
  count: number;
};

export const SidebarTaskSections: React.FC = () => {
  const { trip, localEntries } = useTripWorkspace();
  const planView = usePlanView();
  const spContext = useSpContext();
  const [manualCount, setManualCount] = React.useState(0);
  const [cancellationCount, setCancellationCount] = React.useState(0);
  const [open, setOpen] = React.useState(true);

  const taskCategoryFilter = planView?.taskCategoryFilter ?? null;
  const taskAssigneeFilter = planView?.taskAssigneeFilter ?? null;
  const showEntryDerived = !taskCategoryFilter || taskCategoryFilter !== TASK_FILTER_UNCATEGORISED;
  const showEntryDerivedForAssignee = !taskAssigneeFilter;

  const bookingCount = React.useMemo(() => {
    if (!showEntryDerived || !showEntryDerivedForAssignee) return 0;
    return localEntries.filter((e) => e.bookingRequired && e.bookingStatus === 'Not booked').length;
  }, [localEntries, showEntryDerived, showEntryDerivedForAssignee]);

  const paymentCount = React.useMemo(() => {
    if (!showEntryDerived || !showEntryDerivedForAssignee) return 0;
    return localEntries.filter(
      (e) => (e.paymentStatus === 'Not paid' && e.amount > 0) || e.paymentStatus === 'Part paid'
    ).length;
  }, [localEntries, showEntryDerived, showEntryDerivedForAssignee]);

  React.useEffect(() => {
    if (!trip?.id) {
      setManualCount(0);
      setCancellationCount(0);
      return;
    }
    const svc = new ReminderService(spContext);
    svc
      .getForTrip(trip.id)
      .then((rows) => {
        const incomplete = rows.filter((r) => !r.isComplete);
        setManualCount(
          incomplete.filter((r) => r.reminderType === 'Manual' || r.reminderType === 'ManualEntryTask').length
        );
        setCancellationCount(incomplete.filter((r) => r.reminderType === 'CancellationDeadline').length);
      })
      .catch(() => {
        setManualCount(0);
        setCancellationCount(0);
      });
  }, [trip?.id, spContext, localEntries]);

  if (!planView) return null;

  const active = planView.taskSectionFilter;
  const rows: SectionRow[] = [
    { key: 'todo', label: 'To do', count: manualCount },
    { key: 'bookings', label: 'Bookings needed', count: bookingCount },
    { key: 'payments', label: 'Payments due', count: paymentCount },
    { key: 'cancellations', label: 'Cancellation deadline reminders', count: cancellationCount }
  ];

  return (
    <div className={styles.dayListSection}>
      <button
        type="button"
        className={styles.sectionCollapseHead}
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
      >
        <span className={styles.dayListHeading}>Task sections</span>
        <span className={styles.sectionChevron} aria-hidden>
          {open ? '▾' : '▸'}
        </span>
      </button>
      {open ? (
        <ul className={styles.dayList}>
          <li>
            <button
              type="button"
              className={`${styles.packingCatBtn} ${active === null ? styles.packingCatBtnActive : ''}`}
              onClick={() => planView.setTaskSectionFilter(null)}
            >
              All sections
            </button>
          </li>
          {rows.map((row) => (
            <li key={row.key}>
              <button
                type="button"
                className={`${styles.packingCatBtn} ${active === row.key ? styles.packingCatBtnActive : ''}`}
                onClick={() => planView.setTaskSectionFilter(row.key)}
              >
                {row.label}
                {row.count > 0 ? ` (${row.count})` : ''}
              </button>
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
};
