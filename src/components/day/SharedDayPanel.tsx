import * as React from 'react';
import { useTripWorkspace } from '../../context/TripWorkspaceContext';
import { SharedItinerarySummary } from '../itinerary/SharedItinerarySummary';
import { JournalFeed } from '../journal/JournalFeed';
import { DayHeader } from './DayHeader';
import styles from './DayPanel.module.css';

export const SharedDayPanel: React.FC = () => {
  const { trip, tripDays, selectedDayId, localEntries } = useTripWorkspace();

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

  return (
    <div className={styles.root}>
      <DayHeader variant="shared" day={day} dayTotal={0} onAddEntry={() => undefined} />
      <SharedItinerarySummary entries={entries} dayId={day.id} />
      <JournalFeed dayId={day.id} canModerate={false} />
    </div>
  );
};
