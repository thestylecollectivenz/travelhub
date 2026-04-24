import * as React from 'react';
import type { ItineraryEntry } from '../../models/ItineraryEntry';
import { formatTimeHHMM, minutesFromTimeStart } from '../../utils/itineraryTimeUtils';
import styles from './SharedItinerarySummary.module.css';

export interface SharedItinerarySummaryProps {
  entries: ItineraryEntry[];
  dayId: string;
}

function sortEntriesForDay(entries: ItineraryEntry[], dayId: string): ItineraryEntry[] {
  const forDay = entries.filter((e) => e.dayId === dayId && !e.parentEntryId);
  return [...forDay].sort((a, b) => {
    const aMin = minutesFromTimeStart(a.timeStart);
    const bMin = minutesFromTimeStart(b.timeStart);
    if (aMin !== undefined && bMin !== undefined) return aMin - bMin;
    if (aMin !== undefined) return -1;
    if (bMin !== undefined) return 1;
    return a.sortOrder - b.sortOrder;
  });
}

export const SharedItinerarySummary: React.FC<SharedItinerarySummaryProps> = ({ entries, dayId }) => {
  const sorted = React.useMemo(() => sortEntriesForDay(entries, dayId), [entries, dayId]);

  if (sorted.length === 0) {
    return (
      <div className={styles.empty} role="status">
        Nothing planned for this day yet.
      </div>
    );
  }

  return (
    <ol className={styles.list}>
      {sorted.map((entry) => (
        <li key={entry.id} className={styles.row}>
          <span className={styles.time}>{formatTimeHHMM(entry.timeStart)}</span>
          <span className={styles.title}>{entry.title?.trim() || 'Untitled'}</span>
          <span className={styles.category}>{entry.category}</span>
        </li>
      ))}
    </ol>
  );
};
