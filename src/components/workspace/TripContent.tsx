import * as React from 'react';
import { DayPanel } from '../day/DayPanel';
import { TripSidebar } from '../sidebar/TripSidebar';
import styles from './TripWorkspace.module.css';

export const TripContent: React.FC = () => {
  return (
    <div className={styles.tripContent}>
      <aside className={styles.sidebar} aria-label="Trip navigation and budget">
        <TripSidebar />
      </aside>
      <main className={styles.main}>
        <DayPanel />
      </main>
    </div>
  );
};
