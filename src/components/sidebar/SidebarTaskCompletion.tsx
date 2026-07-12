import * as React from 'react';
import { usePlanView } from '../../context/PlanViewContext';
import type { TaskCompletionFilter } from '../../utils/taskFilters';
import { taskCompletionFilterLabel } from '../../utils/taskFilters';
import styles from './TripSidebar.module.css';

const COMPLETION_KEYS: TaskCompletionFilter[] = ['all', 'incomplete', 'completed'];

export const SidebarTaskCompletion: React.FC = () => {
  const planView = usePlanView();
  const [open, setOpen] = React.useState(true);

  if (!planView) return null;

  const active = planView.taskCompletionFilter;

  return (
    <div className={styles.dayListSection}>
      <button
        type="button"
        className={styles.sectionCollapseHead}
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
      >
        <span className={styles.dayListHeading}>Show tasks</span>
        <span className={styles.sectionChevron} aria-hidden>
          {open ? '▾' : '▸'}
        </span>
      </button>
      {open ? (
        <ul className={styles.dayList}>
          {COMPLETION_KEYS.map((key) => (
            <li key={key}>
              <button
                type="button"
                className={`${styles.packingCatBtn} ${active === key ? styles.packingCatBtnActive : ''}`}
                onClick={() => planView.setTaskCompletionFilter(key)}
              >
                {taskCompletionFilterLabel(key)}
              </button>
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
};
