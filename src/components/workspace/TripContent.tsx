import * as React from 'react';
import { useTripWorkspace } from '../../context/TripWorkspaceContext';
import { MOCK_TRIP_DAYS } from '../../mocks/tripMock';
import styles from './TripWorkspace.module.css';

export const TripContent: React.FC = () => {
  const { selectedDayId, setSelectedDayId } = useTripWorkspace();

  return (
    <div className={styles.tripContent}>
      <aside className={styles.sidebar} aria-label="Trip days">
        <p className={styles.sidebarTitle}>Days (full sidebar in task 2.4)</p>
        <ul className={styles.dayList}>
          {MOCK_TRIP_DAYS.map((day) => {
            const selected = day.id === selectedDayId;
            return (
              <li key={day.id}>
                <button
                  type="button"
                  className={`${styles.dayButton} ${selected ? styles.dayButtonSelected : ''}`}
                  onClick={() => setSelectedDayId(day.id)}
                >
                  <strong>Day {day.dayNumber}</strong>
                  {' — '}
                  {day.displayTitle}
                </button>
              </li>
            );
          })}
        </ul>
      </aside>
      <div className={styles.mainPanel}>
        <p className={styles.mainPlaceholder}>
          Day panel, budget tile, and itinerary (tasks 2.5–2.7). Selected day ID:{' '}
          <code>{selectedDayId}</code>
        </p>
      </div>
    </div>
  );
};
