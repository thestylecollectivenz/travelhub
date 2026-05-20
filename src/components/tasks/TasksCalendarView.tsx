import * as React from 'react';
import { localYmd } from '../../utils/localDate';
import { rangeForCalendarFilter, ymdInRange, type CalendarRangeFilter } from '../../utils/tasksCalendarRange';
import styles from './TasksCalendarView.module.css';

export type { CalendarRangeFilter };

export interface CalendarEvent {
  id: string;
  date: string;
  title: string;
  kind: 'task' | 'reminder' | 'booking' | 'payment';
  entryId?: string;
  dayId?: string;
}

export interface TasksCalendarViewProps {
  events: CalendarEvent[];
  rangeFilter: CalendarRangeFilter;
  customRange?: { start: string; end: string };
  onOpenEntry?: (entryId: string, dayId: string) => void;
}

export const TasksCalendarView: React.FC<TasksCalendarViewProps> = ({
  events,
  rangeFilter,
  customRange,
  onOpenEntry
}) => {
  const { start, end } = React.useMemo(
    () => rangeForCalendarFilter(rangeFilter, customRange),
    [rangeFilter, customRange]
  );

  const filtered = React.useMemo(() => {
    return events
      .filter((ev) => ymdInRange(ev.date, start, end))
      .sort((a, b) => a.date.localeCompare(b.date) || a.title.localeCompare(b.title));
  }, [events, start, end]);

  const byDate = React.useMemo(() => {
    const map = new Map<string, CalendarEvent[]>();
    for (const ev of filtered) {
      const list = map.get(ev.date) ?? [];
      list.push(ev);
      map.set(ev.date, list);
    }
    return map;
  }, [filtered]);

  const dates = React.useMemo(() => Array.from(byDate.keys()).sort(), [byDate]);

  if (!dates.length) {
    return <p className={styles.empty}>Nothing due in this period.</p>;
  }

  return (
    <div className={styles.root}>
      {dates.map((date) => (
        <section key={date} className={styles.dayBlock}>
          <h3 className={styles.dayHeading}>
            {new Date(`${date}T12:00:00`).toLocaleDateString('en-NZ', {
              weekday: 'long',
              day: 'numeric',
              month: 'short',
              year: 'numeric'
            })}
          </h3>
          <ul className={styles.eventList}>
            {(byDate.get(date) ?? []).map((ev) => (
              <li key={ev.id} className={styles.eventItem}>
                <span className={`${styles.kind} ${styles[`kind_${ev.kind}`]}`}>{ev.kind}</span>
                {ev.entryId && ev.dayId && onOpenEntry ? (
                  <button type="button" className={styles.eventLink} onClick={() => onOpenEntry(ev.entryId!, ev.dayId!)}>
                    {ev.title}
                  </button>
                ) : (
                  <span>{ev.title}</span>
                )}
              </li>
            ))}
          </ul>
        </section>
      ))}
    </div>
  );
};
