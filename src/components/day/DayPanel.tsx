import * as React from 'react';
import { useTripWorkspace } from '../../context/TripWorkspaceContext';
import { MOCK_ITINERARY_ENTRIES, MOCK_TRIP_DAYS } from '../../mocks/tripMock';
import { sumForDay } from '../../utils/financialUtils';
import { BudgetBreakdownTile } from './BudgetBreakdownTile';
import { DayHeader } from './DayHeader';
import styles from './DayPanel.module.css';

export const DayPanel: React.FC = () => {
  const { trip, selectedDayId, setEditingCardId } = useTripWorkspace();

  const day = React.useMemo(() => {
    return MOCK_TRIP_DAYS.find((d) => d.tripId === trip.id && d.id === selectedDayId);
  }, [trip.id, selectedDayId]);

  if (!day) {
    return (
      <div className={styles.emptyState} role="status">
        Select a day to get started
      </div>
    );
  }

  const entries = React.useMemo(
    () => MOCK_ITINERARY_ENTRIES.filter((e) => e.tripId === trip.id),
    [trip.id]
  );

  const dayTotal = sumForDay(entries, day.id);

  return (
    <div className={styles.root}>
      <DayHeader day={day} dayTotal={dayTotal} onAddEntry={() => setEditingCardId('new')} />
      <BudgetBreakdownTile tripId={trip.id} dayId={day.id} />
      <div className={styles.timelineSlot}>Itinerary timeline (task 2.6)</div>
    </div>
  );
};
