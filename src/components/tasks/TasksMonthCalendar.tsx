import * as React from 'react';
import type { CalendarEvent, CalendarRangeFilter } from './TasksCalendarView';
import styles from './TasksMonthCalendar.module.css';

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

export interface TasksMonthCalendarProps {
  events: CalendarEvent[];
  rangeFilter: CalendarRangeFilter;
  onOpenEntry?: (entryId: string, dayId: string) => void;
}

export const TasksMonthCalendar: React.FC<TasksMonthCalendarProps> = ({ events, rangeFilter, onOpenEntry }) => {
  const { start, end } = React.useMemo(() => rangeForFilter(rangeFilter), [rangeFilter]);

  const [viewMonth, setViewMonth] = React.useState(() => {
    const d = startOfDay(start);
    return new Date(d.getFullYear(), d.getMonth(), 1);
  });

  React.useEffect(() => {
    const anchor = startOfDay(start);
    setViewMonth(new Date(anchor.getFullYear(), anchor.getMonth(), 1));
  }, [rangeFilter, start]);

  const eventsByDate = React.useMemo(() => {
    const map = new Map<string, CalendarEvent[]>();
    const s = toYmd(start);
    const e = toYmd(end);
    for (const ev of events) {
      if (ev.date < s || ev.date > e) continue;
      const list = map.get(ev.date) ?? [];
      list.push(ev);
      map.set(ev.date, list);
    }
    return map;
  }, [events, start, end]);

  const grid = React.useMemo(() => {
    const year = viewMonth.getFullYear();
    const month = viewMonth.getMonth();
    const first = new Date(year, month, 1);
    const last = new Date(year, month + 1, 0);
    const startPad = (first.getDay() + 6) % 7;
    const cells: Array<{ ymd: string; inMonth: boolean; date: Date }> = [];
    const gridStart = addDays(first, -startPad);
    for (let i = 0; i < 42; i++) {
      const date = addDays(gridStart, i);
      const inMonth = date.getMonth() === month;
      cells.push({ ymd: toYmd(date), inMonth, date });
    }
    if (cells[35].date > last && cells[34].date.getMonth() !== month) {
      return cells.slice(0, 35);
    }
    return cells;
  }, [viewMonth]);

  const monthLabel = viewMonth.toLocaleDateString('en-NZ', { month: 'long', year: 'numeric' });

  return (
    <div className={styles.root}>
      <div className={styles.toolbar}>
        <button type="button" className={styles.navBtn} onClick={() => setViewMonth((m) => new Date(m.getFullYear(), m.getMonth() - 1, 1))}>
          ‹
        </button>
        <span className={styles.monthLabel}>{monthLabel}</span>
        <button type="button" className={styles.navBtn} onClick={() => setViewMonth((m) => new Date(m.getFullYear(), m.getMonth() + 1, 1))}>
          ›
        </button>
      </div>
      <div className={styles.weekdays}>
        {['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].map((d) => (
          <span key={d} className={styles.weekday}>
            {d}
          </span>
        ))}
      </div>
      <div className={styles.grid}>
        {grid.map((cell) => {
          const dayEvents = eventsByDate.get(cell.ymd) ?? [];
          const todayYmd = toYmd(startOfDay(new Date()));
          return (
            <div
              key={cell.ymd}
              className={`${styles.cell} ${cell.inMonth ? '' : styles.cellOutside} ${cell.ymd === todayYmd ? styles.cellToday : ''}`}
            >
              <span className={styles.cellDay}>{cell.date.getDate()}</span>
              <ul className={styles.cellEvents}>
                {dayEvents.slice(0, 3).map((ev) => (
                  <li key={ev.id}>
                    {ev.entryId && ev.dayId && onOpenEntry ? (
                      <button type="button" className={styles.eventBtn} onClick={() => onOpenEntry(ev.entryId!, ev.dayId!)}>
                        {ev.title}
                      </button>
                    ) : (
                      <span className={styles.eventText}>{ev.title}</span>
                    )}
                  </li>
                ))}
                {dayEvents.length > 3 ? <li className={styles.more}>+{dayEvents.length - 3} more</li> : null}
              </ul>
            </div>
          );
        })}
      </div>
    </div>
  );
};
