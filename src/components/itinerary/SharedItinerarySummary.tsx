import * as React from 'react';
import type { ItineraryEntry } from '../../models/ItineraryEntry';
import type { TripDay } from '../../models/TripDay';
import { formatTimeHHMM, minutesFromTimeStart } from '../../utils/itineraryTimeUtils';
import { effectivePlannerTimeStart, sortEntriesForDay } from '../../utils/itineraryDayEntries';
import styles from './SharedItinerarySummary.module.css';

export interface SharedItinerarySummaryProps {
  entries: ItineraryEntry[];
  dayId: string;
  calendarDate: string;
  dayType?: string;
  /** Pass the trip pre-trip day id so span logic never attaches to the wrong day. */
  preTripDayId?: string;
  tripDays?: TripDay[];
}

export const SharedItinerarySummary: React.FC<SharedItinerarySummaryProps> = ({
  entries,
  dayId,
  calendarDate,
  dayType,
  preTripDayId,
  tripDays
}) => {
  const sorted = React.useMemo(
    () => sortEntriesForDay(entries, dayId, calendarDate, dayType, preTripDayId, undefined, tripDays),
    [entries, dayId, calendarDate, dayType, preTripDayId, tripDays]
  );

  const sortedWithTime = React.useMemo(() => {
    return [...sorted].sort((a, b) => {
      const aMin = minutesFromTimeStart(effectivePlannerTimeStart(a, calendarDate, tripDays));
      const bMin = minutesFromTimeStart(effectivePlannerTimeStart(b, calendarDate, tripDays));
      if (aMin !== undefined && bMin !== undefined) return aMin - bMin;
      if (aMin !== undefined) return -1;
      if (bMin !== undefined) return 1;
      return (a.sortOrder ?? 0) - (b.sortOrder ?? 0);
    });
  }, [sorted, calendarDate, tripDays]);

  if (sortedWithTime.length === 0) {
    return (
      <div className={styles.empty} role="status">
        Nothing planned for this day yet.
      </div>
    );
  }

  return (
    <ol className={styles.list}>
      {sortedWithTime.map((entry) => (
        <li key={entry.id} className={styles.row}>
          <span className={styles.time}>{formatTimeHHMM(effectivePlannerTimeStart(entry, calendarDate, tripDays))}</span>
          <span className={styles.title}>
            {entry.title?.trim() || 'Untitled'}
            {(entry.subItems ?? []).length > 0 ? (
              <span style={{ display: 'block', marginTop: '4px', fontSize: 'var(--font-size-xs)', color: 'var(--color-sand-700)' }}>
                Related items: {(entry.subItems ?? []).map((s) => s.title?.trim() || 'Untitled').join(' · ')}
              </span>
            ) : null}
          </span>
          <span className={styles.category}>{entry.category}</span>
        </li>
      ))}
    </ol>
  );
};
