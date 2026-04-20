import * as React from 'react';
import { useTripWorkspace } from '../../context/TripWorkspaceContext';
import { MOCK_TRIP_DAYS } from '../../mocks/tripMock';
import { sumForDay } from '../../utils/financialUtils';
import { SidebarDayItem } from './SidebarDayItem';
import styles from './TripSidebar.module.css';

export const SidebarDayList: React.FC = () => {
  const { trip, selectedDayId, setSelectedDayId, localEntries } = useTripWorkspace();

  const days = React.useMemo(() => {
    return MOCK_TRIP_DAYS.filter((d) => d.tripId === trip.id).sort((a, b) => a.dayNumber - b.dayNumber);
  }, [trip.id]);

  const entries = React.useMemo(() => localEntries.filter((e) => e.tripId === trip.id), [localEntries, trip.id]);

  return (
    <div className={styles.dayListSection}>
      <h2 className={styles.dayListHeading}>Itinerary</h2>
      <ul className={styles.dayList}>
        {days.map((day) => (
          <SidebarDayItem
            key={day.id}
            day={day}
            isSelected={day.id === selectedDayId}
            onSelect={() => setSelectedDayId(day.id)}
            dayTotal={sumForDay(entries, day.id)}
          />
        ))}
      </ul>
    </div>
  );
};
