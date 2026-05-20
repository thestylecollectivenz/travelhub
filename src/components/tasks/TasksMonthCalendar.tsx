import * as React from 'react';

import type { CalendarEvent } from './TasksCalendarView';

import { localYmd } from '../../utils/localDate';

import {

  addDays,

  initialCalendarMonth,

  rangeForCalendarFilter,

  startOfDay,

  ymdInRange,

  type CalendarRangeFilter

} from '../../utils/tasksCalendarRange';

import styles from './TasksMonthCalendar.module.css';



export type { CalendarRangeFilter };



export interface TasksMonthCalendarProps {

  events: CalendarEvent[];

  rangeFilter: CalendarRangeFilter;

  customRange?: { start: string; end: string };

  tripStartYmd?: string;

  onOpenEntry?: (entryId: string, dayId: string) => void;

}



export const TasksMonthCalendar: React.FC<TasksMonthCalendarProps> = ({

  events,

  rangeFilter,

  customRange,

  tripStartYmd,

  onOpenEntry

}) => {

  const { start, end } = React.useMemo(

    () => rangeForCalendarFilter(rangeFilter, customRange),

    [rangeFilter, customRange]

  );



  const [viewMonth, setViewMonth] = React.useState(() => initialCalendarMonth(events, tripStartYmd));



  React.useEffect(() => {

    setViewMonth(initialCalendarMonth(events, tripStartYmd));

  }, [rangeFilter, tripStartYmd, events.length]);



  const eventsByDate = React.useMemo(() => {

    const map = new Map<string, CalendarEvent[]>();

    for (const ev of events) {

      if (!ymdInRange(ev.date, start, end)) continue;

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

      cells.push({ ymd: localYmd(date), inMonth, date });

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

          const todayYmd = localYmd(startOfDay(new Date()));

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

