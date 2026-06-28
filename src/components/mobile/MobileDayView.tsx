import * as React from 'react';
import { useTripWorkspace } from '../../context/TripWorkspaceContext';
import { sortEntriesForDay, isPreTripDayRow, resolvePreTripDayId } from '../../utils/itineraryDayEntries';
import { formatOrdinalDayDate } from '../../utils/formatTripDayDate';
import {
  expandPlannerTimedItems,
  expandPlannerUnscheduledItems,
  shouldRenderPlannerItem
} from '../../utils/plannerCalendarItems';
import { formatTimeHHMM } from '../../utils/itineraryTimeUtils';
import { getCategorySlug } from '../../utils/categoryUtils';
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

function formatPlannerMinutes(minutes: number): string {
  const h = Math.floor(minutes / 60) % 24;
  const m = minutes % 60;
  const pad2 = (n: number): string => (n < 10 ? `0${n}` : String(n));
  return formatTimeHHMM(`${pad2(h)}:${pad2(m)}`);
}

export const MobileDayView: React.FC = () => {
  const { trip, tripDays, localEntries, selectedDayId, setSelectedDayId } = useTripWorkspace();
  const [detailEntryId, setDetailEntryId] = React.useState<string | null>(null);
  const [unschedOpen, setUnschedOpen] = React.useState(false);

  const days = React.useMemo(
    () =>
      trip
        ? tripDays.filter((d) => d.tripId === trip.id && !isPreTripDayRow(d)).sort((a, b) => a.dayNumber - b.dayNumber)
        : [],
    [trip, tripDays]
  );

  React.useEffect(() => {
    if (!selectedDayId && days.length) setSelectedDayId(days[0].id);
  }, [days, selectedDayId, setSelectedDayId]);

  const day = days.find((d) => d.id === selectedDayId) ?? days[0];
  const preTripDayId = resolvePreTripDayId(tripDays, trip?.id ?? '');

  const dayEntries = React.useMemo(() => {
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

  const unscheduled = React.useMemo(() => {
    if (!day) return [];
    return expandPlannerUnscheduledItems(dayEntries, day.calendarDate, tripDays, localEntries);
  }, [day, dayEntries, tripDays, localEntries]);

  const timed = React.useMemo(() => {
    if (!day) return [];
    return expandPlannerTimedItems(dayEntries, day.calendarDate, tripDays, localEntries).filter(
      shouldRenderPlannerItem
    );
  }, [day, dayEntries, tripDays, localEntries]);

  const detailEntry = detailEntryId ? localEntries.find((e) => e.id === detailEntryId) : undefined;

  const jumpToDate = (ymd: string): void => {
    const match = days.find((d) => (d.calendarDate || '').slice(0, 10) === ymd);
    if (match) setSelectedDayId(match.id);
  };

  if (!trip || !day) return <p className={styles.muted}>No trip days yet.</p>;

  if (detailEntry) {
    return <MobileCardDetail entry={detailEntry} onClose={() => setDetailEntryId(null)} />;
  }

  const dayIndex = days.findIndex((d) => d.id === day.id);
  const tripStartYmd = (trip.dateStart || '').slice(0, 10);
  const tripEndYmd = (trip.dateEnd || '').slice(0, 10);
  const dayYmd = (day.calendarDate || '').slice(0, 10);

  return (
    <div className={styles.dayView}>
      <div className={styles.dayHeaderCompact}>
        <div>
          <h2 className={styles.dayTitleCompact}>{day.displayTitle || `Day ${day.dayNumber}`}</h2>
          <p className={styles.dayDateCompact}>
            {day.calendarDate ? formatOrdinalDayDate(day.calendarDate) : ''}
          </p>
        </div>
        <input
          type="date"
          className={styles.dateInputCompact}
          min={tripStartYmd || undefined}
          max={tripEndYmd || undefined}
          value={dayYmd}
          onChange={(e) => jumpToDate(e.target.value)}
          aria-label="Go to date within trip"
        />
      </div>
      <div className={styles.dayNavCompact}>
        <button type="button" className={styles.navChip} onClick={() => jumpToDate(ymdToday())}>
          Today
        </button>
        <button type="button" className={styles.navChip} onClick={() => jumpToDate(ymdTomorrow())}>
          Tmrw
        </button>
        <button
          type="button"
          className={styles.navChip}
          disabled={dayIndex <= 0}
          onClick={() => dayIndex > 0 && setSelectedDayId(days[dayIndex - 1].id)}
          aria-label="Previous day"
        >
          ←
        </button>
        <button
          type="button"
          className={styles.navChip}
          disabled={dayIndex < 0 || dayIndex >= days.length - 1}
          onClick={() => dayIndex >= 0 && dayIndex < days.length - 1 && setSelectedDayId(days[dayIndex + 1].id)}
          aria-label="Next day"
        >
          →
        </button>
      </div>

      {unscheduled.length > 0 ? (
        <section className={styles.unschedSection}>
          <button type="button" className={styles.unschedToggle} onClick={() => setUnschedOpen((v) => !v)}>
            <span>Unscheduled</span>
            <span className={styles.unschedMeta}>
              {unscheduled.length} · {unschedOpen ? 'Hide' : 'Show'}
            </span>
          </button>
          {unschedOpen ? (
            <div className={styles.unschedBody}>
              {unscheduled.map((item) => (
                <button
                  key={item.key}
                  type="button"
                  className={styles.cardBtn}
                  onClick={() => setDetailEntryId(item.entry.id)}
                >
                  <div className={styles.cardTitle}>{item.title}</div>
                  <div className={styles.cardMeta}>
                    {item.entry.category}
                    {item.subItem ? ' · Option' : ''}
                  </div>
                </button>
              ))}
            </div>
          ) : null}
        </section>
      ) : null}

      {timed.length === 0 && unscheduled.length === 0 ? (
        <p className={styles.muted}>No itinerary items for this day.</p>
      ) : timed.length > 0 ? (
        <div className={styles.mobileTimeline}>
          <div className={styles.mobileRail} aria-hidden />
          {timed.map((item) => {
            const categorySlug = getCategorySlug(item.category || item.entry.category);
            const timeLabel = formatPlannerMinutes(item.startMinutes);
            return (
              <div key={item.key} className={styles.timelineRow}>
                <div className={styles.timeCell}>{timeLabel}</div>
                <div className={styles.nodeWrap}>
                  <div className={styles.node} data-category={categorySlug} />
                </div>
                <button
                  type="button"
                  className={styles.timelineCard}
                  onClick={() => setDetailEntryId(item.entry.id)}
                >
                  <div className={styles.cardTitle}>{item.title}</div>
                  <div className={styles.cardMeta}>{item.entry.category}</div>
                </button>
              </div>
            );
          })}
        </div>
      ) : null}
    </div>
  );
};
