import * as React from 'react';
import { useTripWorkspace } from '../../context/TripWorkspaceContext';
import { SharedItinerarySummary } from '../itinerary/SharedItinerarySummary';
import { JournalFeed } from '../journal/JournalFeed';
import { DayHeader } from './DayHeader';
import styles from './DayPanel.module.css';

export const SharedDayPanel: React.FC = () => {
  const { trip, tripDays, selectedDayId, localEntries } = useTripWorkspace();

  const visibleDays = React.useMemo(() => {
    if (!trip) return [];
    return tripDays.filter((d) => d.tripId === trip.id && d.dayType !== 'PreTrip').sort((a, b) => a.dayNumber - b.dayNumber);
  }, [trip, tripDays]);

  const effectiveSelectedDayId = React.useMemo(() => {
    if (visibleDays.some((d) => d.id === selectedDayId)) return selectedDayId;
    return visibleDays[0]?.id ?? '';
  }, [visibleDays, selectedDayId]);
  const day = React.useMemo(() => visibleDays.find((d) => d.id === effectiveSelectedDayId), [visibleDays, effectiveSelectedDayId]);

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
      <SharedItinerarySummary entries={entries} dayId={day.id} calendarDate={day.calendarDate} dayType={day.dayType} />
      <JournalFeed dayId={day.id} canModerate={false} />
    </div>
  );
};
