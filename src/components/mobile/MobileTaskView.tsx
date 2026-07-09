import * as React from 'react';
import { PlanViewProvider } from '../../context/PlanViewContext';
import { usePlanView } from '../../context/PlanViewContext';
import { useTripWorkspace } from '../../context/TripWorkspaceContext';
import { useTripMembers } from '../../hooks/useTripMembers';
import { TripTasksView } from '../tasks/TripTasksView';
import styles from './MobileShell.module.css';

const MobileTaskBody: React.FC = () => {
  const planView = usePlanView();
  const { trip } = useTripWorkspace();
  const { travellers } = useTripMembers(trip?.id);
  const active = planView?.taskAssigneeFilter ?? null;

  return (
    <>
      <div className={styles.filterGroup}>
        <span className={styles.filterLabel}>Assigned to</span>
        <div className={styles.filterChips}>
          <button
            type="button"
            className={`${styles.pagerBtn} ${active === null ? styles.pagerBtnActive : ''}`}
            onClick={() => planView?.setTaskAssigneeFilter(null)}
          >
            All
          </button>
          {travellers.map((name) => (
            <button
              key={name}
              type="button"
              className={`${styles.pagerBtn} ${active === name ? styles.pagerBtnActive : ''}`}
              onClick={() => planView?.setTaskAssigneeFilter(name)}
            >
              {name}
            </button>
          ))}
        </div>
      </div>
      <TripTasksView variant="tasks" />
    </>
  );
};

export const MobileTaskView: React.FC = () => (
  <PlanViewProvider>
    <MobileTaskBody />
  </PlanViewProvider>
);
