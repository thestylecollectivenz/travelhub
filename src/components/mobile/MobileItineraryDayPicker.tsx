import * as React from 'react';
import type { TripDay } from '../../models/TripDay';
import { isPreTripDayRow } from '../../utils/itineraryDayEntries';
import styles from './MobileItineraryDayPicker.module.css';

export interface MobileItineraryDayPickerProps {
  days: TripDay[];
  showPreTrip?: boolean;
  onSelect: (dayId: string) => void;
  onCancel: () => void;
}

function dayLabel(day: TripDay): string {
  const date = (day.calendarDate || '').slice(0, 10);
  const title = (day.displayTitle || '').trim();
  if (title && date) {
    const d = new Date(`${date}T12:00:00`);
    const datePart = Number.isNaN(d.getTime())
      ? date
      : d.toLocaleDateString('en-NZ', { weekday: 'short', day: 'numeric', month: 'short' });
    return `${title} · ${datePart}`;
  }
  if (title) return title;
  if (date) {
    const d = new Date(`${date}T12:00:00`);
    return Number.isNaN(d.getTime())
      ? date
      : d.toLocaleDateString('en-NZ', { weekday: 'short', day: 'numeric', month: 'short' });
  }
  return `Day ${day.dayNumber}`;
}

export const MobileItineraryDayPicker: React.FC<MobileItineraryDayPickerProps> = ({
  days,
  showPreTrip = true,
  onSelect,
  onCancel
}) => {
  const visible = React.useMemo(
    () =>
      [...days]
        .filter((d) => showPreTrip || !isPreTripDayRow(d))
        .sort((a, b) => a.dayNumber - b.dayNumber),
    [days, showPreTrip]
  );

  return (
    <div className={styles.backdrop} role="presentation" onMouseDown={(e) => e.target === e.currentTarget && onCancel()}>
      <div className={styles.sheet} role="dialog" aria-modal="true" aria-labelledby="itin-day-pick-title">
        <h2 id="itin-day-pick-title" className={styles.title}>
          Which day is this for?
        </h2>
        <p className={styles.sub}>Choose the day and location this itinerary item belongs to.</p>
        <ul className={styles.list}>
          {visible.map((d) => (
            <li key={d.id}>
              <button type="button" className={styles.dayBtn} onClick={() => onSelect(d.id)}>
                {dayLabel(d)}
                {isPreTripDayRow(d) ? <span className={styles.preTrip}>Pre-trip</span> : null}
              </button>
            </li>
          ))}
        </ul>
        <button type="button" className={styles.cancelBtn} onClick={onCancel}>
          Cancel
        </button>
      </div>
    </div>
  );
};
