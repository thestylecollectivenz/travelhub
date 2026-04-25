import * as React from 'react';
import { useTripWorkspace } from '../../context/TripWorkspaceContext';
import { ItineraryTimeline } from '../itinerary/ItineraryTimeline';
import { JournalFeed } from '../journal/JournalFeed';
import { sumForDay } from '../../utils/financialUtils';
import { BudgetBreakdownTile } from './BudgetBreakdownTile';
import { DayHeader } from './DayHeader';
import styles from './DayPanel.module.css';

export const DayPanel: React.FC = () => {
  const { trip, tripDays, selectedDayId, setEditingCardId, localEntries, convertToHomeCurrency } = useTripWorkspace();
  const [openJournalSignal, setOpenJournalSignal] = React.useState(0);

  const day = React.useMemo(() => {
    if (!trip) return undefined;
    return tripDays.find((d) => d.tripId === trip.id && d.id === selectedDayId);
  }, [trip, tripDays, selectedDayId]);

  if (!day || !trip) {
    return (
      <div className={styles.emptyState} role="status">
        Select a day to get started
      </div>
    );
  }

  const entries = React.useMemo(() => localEntries.filter((e) => e.tripId === trip.id), [localEntries, trip.id]);

  const dayTotal = sumForDay(entries, day.id, convertToHomeCurrency, day.calendarDate);

  return (
    <div className={styles.root}>
      <DayHeader
        day={day}
        dayTotal={dayTotal}
        onAddEntry={() => setEditingCardId('new')}
        onWriteJournal={() => setOpenJournalSignal((n) => n + 1)}
      />
      <BudgetBreakdownTile tripId={trip.id} dayId={day.id} />
      <ItineraryTimeline dayId={day.id} />
      <JournalFeed dayId={day.id} openComposerSignal={openJournalSignal} />
    </div>
  );
};
