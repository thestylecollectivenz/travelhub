import * as React from 'react';
import { useTripWorkspace } from '../../context/TripWorkspaceContext';
import { sortEntriesForDay, isPreTripDayRow, resolvePreTripDayId } from '../../utils/itineraryDayEntries';
import { formatOrdinalDayDate } from '../../utils/formatTripDayDate';
import { MobileCardDetail } from './MobileCardDetail';
import styles from './MobileShell.module.css';

function ymdToday(): string {
  const d = new Date();
  return d.toISOString().slice(0, 10);
}

function ymdTomorrow(): string {
  const d = new Date();
  d.setDate(d.getDate() + 1);
  return d.toISOString().slice(0, 10);
}

export const MobileDayView: React.FC = () => {
  const { trip, tripDays, localEntries, selectedDayId, setSelectedDayId } = useTripWorkspace();
  const [detailEntryId, setDetailEntryId] = React.useState<string | null>(null);

  const days = React.useMemo(
    () => (trip ? tripDays.filter((d) => d.tripId === trip.id && !isPreTripDayRow(d)).sort((a, b) => a.dayNumber - b.dayNumber) : []),
    [trip, tripDays]
  );

  React.useEffect(() => {
    if (!selectedDayId && days.length) setSelectedDayId(days[0].id);
  }, [days, selectedDayId, setSelectedDayId]);

  const day = days.find((d) => d.id === selectedDayId) ?? days[0];
  const preTripDayId = resolvePreTripDayId(tripDays, trip?.id ?? '');

  const entries = React.useMemo(() => {
    if (!day || !trip) return [];
    return sortEntriesForDay(
      localEntries,
      day.id,
      day.calendarDate,
      day.dayType,
      preTripDayId,
      isPreTripDayRow(day),
      tripDays
    ).filter((e) => e.dayId === day.id && !e.parentEntryId);
  }, [day, trip, localEntries, preTripDayId, tripDays]);

  const detailEntry = detailEntryId ? entries.find((e) => e.id === detailEntryId) : undefined;

  const jumpToDate = (ymd: string): void => {
    const match = days.find((d) => (d.calendarDate || '').slice(0, 10) === ymd);
    if (match) setSelectedDayId(match.id);
  };

  if (!trip || !day) return <p className={styles.muted}>No trip days yet.</p>;

  if (detailEntry) {
    return <MobileCardDetail entry={detailEntry} onClose={() => setDetailEntryId(null)} />;
  }

  const dayIndex = days.findIndex((d) => d.id === day.id);

  return (
    <div>
      <h2 className={styles.sectionHeading}>{day.displayTitle || `Day ${day.dayNumber}`}</h2>
      <p className={styles.muted}>{day.calendarDate ? formatOrdinalDayDate(day.calendarDate) : ''}</p>
      <div className={styles.pagerRow}>
        <button type="button" className={styles.pagerBtn} onClick={() => jumpToDate(ymdToday())}>
          Today
        </button>
        <button type="button" className={styles.pagerBtn} onClick={() => jumpToDate(ymdTomorrow())}>
          Tomorrow
        </button>
        <button
          type="button"
          className={styles.pagerBtn}
          disabled={dayIndex <= 0}
          onClick={() => dayIndex > 0 && setSelectedDayId(days[dayIndex - 1].id)}
        >
          ← Prev
        </button>
        <button
          type="button"
          className={styles.pagerBtn}
          disabled={dayIndex < 0 || dayIndex >= days.length - 1}
          onClick={() => dayIndex >= 0 && dayIndex < days.length - 1 && setSelectedDayId(days[dayIndex + 1].id)}
        >
          Next →
        </button>
      </div>
      {entries.length === 0 ? (
        <p className={styles.muted}>No itinerary items for this day.</p>
      ) : (
        entries.map((entry) => (
          <button key={entry.id} type="button" className={styles.cardBtn} onClick={() => setDetailEntryId(entry.id)}>
            <div className={styles.cardTitle}>{entry.title}</div>
            <div className={styles.cardMeta}>
              {entry.category}
              {entry.timeStart ? ` · ${entry.timeStart.slice(0, 5)}` : ''}
            </div>
          </button>
        ))
      )}
    </div>
  );
};
