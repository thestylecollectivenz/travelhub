import * as React from 'react';
import { useTripWorkspace } from '../../context/TripWorkspaceContext';
import { TripSidebar } from '../sidebar/TripSidebar';
import styles from './TripWorkspace.module.css';

export const TripContent: React.FC = () => {
  const { selectedDayId } = useTripWorkspace();

  return (
    <div className={styles.tripContent}>
      <aside className={styles.sidebar} aria-label="Trip navigation and budget">
        <TripSidebar />
      </aside>
      <main className={styles.main}>
        <div className={styles.dayPanelSlot}>
          Day panel coming in 2.5. Selected day ID: <code>{selectedDayId}</code>
        </div>
      </main>
    </div>
  );
};
