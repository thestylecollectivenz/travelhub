import * as React from 'react';
import { useTripWorkspace } from '../../context/TripWorkspaceContext';
import { usePlanView } from '../../context/PlanViewContext';
import { useSpContext } from '../../context/SpContext';
import { ReminderService } from '../../services/ReminderService';
import { loadTripAssignees } from '../../utils/tripAssignees';
import styles from './TripSidebar.module.css';

export const SidebarTaskAssignees: React.FC = () => {
  const { trip } = useTripWorkspace();
  const planView = usePlanView();
  const spContext = useSpContext();
  const filter = planView?.taskAssigneeFilter ?? null;
  const [assignees, setAssignees] = React.useState<string[]>([]);

  React.useEffect(() => {
    if (!trip?.id) {
      setAssignees([]);
      return;
    }
    const stored = loadTripAssignees(trip.id);
    const svc = new ReminderService(spContext);
    svc
      .getForTrip(trip.id)
      .then((rows) => {
        const fromReminders = new Set<string>();
        for (const r of rows) {
          const a = (r.assignedTo || '').trim();
          if (a) fromReminders.add(a);
        }
        const fromList = Array.from(fromReminders);
        const merged = [...fromList, ...stored.filter((n) => !fromReminders.has(n))].sort((a, b) =>
          a.localeCompare(b)
        );
        setAssignees(merged);
      })
      .catch(() => setAssignees(stored));
  }, [trip?.id, spContext]);

  if (!planView) return null;

  return (
    <div className={styles.dayListSection}>
      <h2 className={styles.dayListHeading}>Assigned to</h2>
      {assignees.length === 0 ? (
        <p className={styles.dayListHint}>No assignees yet — set Assigned to on a task.</p>
      ) : (
        <ul className={styles.dayList}>
          <li>
            <button
              type="button"
              className={`${styles.packingCatBtn} ${filter === null ? styles.packingCatBtnActive : ''}`}
              onClick={() => planView.setTaskAssigneeFilter(null)}
            >
              Anyone
            </button>
          </li>
          {assignees.map((name) => (
            <li key={name}>
              <button
                type="button"
                className={`${styles.packingCatBtn} ${filter === name ? styles.packingCatBtnActive : ''}`}
                onClick={() => planView.setTaskAssigneeFilter(name)}
              >
                {name}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
};
