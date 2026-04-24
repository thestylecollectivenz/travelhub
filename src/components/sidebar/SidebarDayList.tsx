import * as React from 'react';
import { useTripWorkspace } from '../../context/TripWorkspaceContext';
import { sumForDay } from '../../utils/financialUtils';
import { SidebarDayItem } from './SidebarDayItem';
import styles from './TripSidebar.module.css';

export const SidebarDayList: React.FC = () => {
  const { trip, tripDays, selectedDayId, setSelectedDayId, localEntries, convertToHomeCurrency } = useTripWorkspace();

  const days = React.useMemo(() => {
    if (!trip) return [];
    return tripDays
      .filter((d) => d.tripId === trip.id)
      .sort((a, b) => a.dayNumber - b.dayNumber);
  }, [trip, tripDays]);

  const entries = React.useMemo(
    () => (trip ? localEntries.filter((e) => e.tripId === trip.id) : []),
    [localEntries, trip]
  );

  return (
    <div className={styles.dayListSection}>
      <h2 className={styles.dayListHeading}>Days</h2>
      <ul className={styles.dayList}>
        {days.map((day) => (
          <SidebarDayItem
            key={day.id}
            day={day}
            isSelected={day.id === selectedDayId}
            onSelect={() => setSelectedDayId(day.id)}
            dayTotal={sumForDay(entries, day.id, convertToHomeCurrency)}
          />
        ))}
      </ul>
    </div>
  );
};
