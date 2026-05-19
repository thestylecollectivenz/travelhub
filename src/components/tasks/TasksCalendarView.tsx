import * as React from 'react';
import styles from './TasksCalendarView.module.css';

export type CalendarRangeFilter = 'this_week' | 'this_month' | 'next_week' | 'next_month' | 'all';

export interface CalendarEvent {
  id: string;
  date: string;
  title: string;
  kind: 'task' | 'reminder' | 'booking' | 'payment';
  entryId?: string;
  dayId?: string;
}

function startOfDay(d: Date): Date {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  return x;
}

function addDays(d: Date, n: number): Date {
  const x = new Date(d);
  x.setDate(x.getDate() + n);
  return x;
}

function toYmd(d: Date): string {
  return d.toISOString().slice(0, 10);
}

function rangeForFilter(filter: CalendarRangeFilter): { start: Date; end: Date } {
  const today = startOfDay(new Date());
  const day = today.getDay();
  const mondayOffset = day === 0 ? -6 : 1 - day;
  const thisWeekStart = addDays(today, mondayOffset);
  const thisWeekEnd = addDays(thisWeekStart, 6);
  const nextWeekStart = addDays(thisWeekStart, 7);
  const nextWeekEnd = addDays(nextWeekStart, 6);
  const thisMonthStart = new Date(today.getFullYear(), today.getMonth(), 1);
  const thisMonthEnd = new Date(today.getFullYear(), today.getMonth() + 1, 0);
  const nextMonthStart = new Date(today.getFullYear(), today.getMonth() + 1, 1);
  const nextMonthEnd = new Date(today.getFullYear(), today.getMonth() + 2, 0);

  switch (filter) {
    case 'this_week':
      return { start: thisWeekStart, end: thisWeekEnd };
    case 'next_week':
      return { start: nextWeekStart, end: nextWeekEnd };
    case 'this_month':
      return { start: thisMonthStart, end: thisMonthEnd };
    case 'next_month':
      return { start: nextMonthStart, end: nextMonthEnd };
    default:
      return { start: addDays(today, -365), end: addDays(today, 730) };
  }
}

export interface TasksCalendarViewProps {
  events: CalendarEvent[];
  rangeFilter: CalendarRangeFilter;
  onOpenEntry?: (entryId: string, dayId: string) => void;
}

export const TasksCalendarView: React.FC<TasksCalendarViewProps> = ({ events, rangeFilter, onOpenEntry }) => {
  const { start, end } = React.useMemo(() => rangeForFilter(rangeFilter), [rangeFilter]);

  const filtered = React.useMemo(() => {
    const s = toYmd(start);
    const e = toYmd(end);
    return events
      .filter((ev) => ev.date >= s && ev.date <= e)
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
