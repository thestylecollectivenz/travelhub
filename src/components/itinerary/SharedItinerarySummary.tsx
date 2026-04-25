import * as React from 'react';
import type { ItineraryEntry } from '../../models/ItineraryEntry';
import { formatTimeHHMM, minutesFromTimeStart } from '../../utils/itineraryTimeUtils';
import styles from './SharedItinerarySummary.module.css';

export interface SharedItinerarySummaryProps {
  entries: ItineraryEntry[];
  dayId: string;
  calendarDate: string;
}

function isAccommodationOnDate(entry: ItineraryEntry, calendarDate: string): boolean {
  if (entry.category !== 'Accommodation' || !entry.dateStart || !entry.dateEnd || !calendarDate) return false;
  const day = new Date(`${calendarDate}T00:00:00.000Z`);
  const start = new Date(`${entry.dateStart}T00:00:00.000Z`);
  const end = new Date(`${entry.dateEnd}T00:00:00.000Z`);
  if (Number.isNaN(day.getTime()) || Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) return false;
  return day.getTime() >= start.getTime() && day.getTime() < end.getTime();
}

function sortEntriesForDay(entries: ItineraryEntry[], dayId: string, calendarDate: string): ItineraryEntry[] {
  const map = new Map<string, ItineraryEntry>();
  for (const e of entries) {
    if (e.parentEntryId) continue;
    if (e.dayId === dayId || isAccommodationOnDate(e, calendarDate)) {
      map.set(e.id, e);
    }
  }
  const forDay = Array.from(map.values());
  return [...forDay].sort((a, b) => {
    const aMin = minutesFromTimeStart(a.timeStart);
    const bMin = minutesFromTimeStart(b.timeStart);
    if (aMin !== undefined && bMin !== undefined) return aMin - bMin;
    if (aMin !== undefined) return -1;
    if (bMin !== undefined) return 1;
    return a.sortOrder - b.sortOrder;
  });
}

export const SharedItinerarySummary: React.FC<SharedItinerarySummaryProps> = ({ entries, dayId, calendarDate }) => {
  const sorted = React.useMemo(() => sortEntriesForDay(entries, dayId, calendarDate), [entries, dayId, calendarDate]);

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
