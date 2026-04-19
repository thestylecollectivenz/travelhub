import * as React from 'react';
import type { TripDay } from '../../models/TripDay';
import { formatDayDate } from '../../utils/dateUtils';
import { formatNZD } from '../../utils/financialUtils';
import styles from './DayHeader.module.css';

export interface DayHeaderProps {
  day: TripDay;
  dayTotal: number;
  onAddEntry: () => void;
}

export const DayHeader: React.FC<DayHeaderProps> = ({ day, dayTotal, onAddEntry }) => {
  return (
    <header className={styles.bar}>
      <div className={styles.left}>
        <div className={styles.line1}>
          <span className={styles.dayNumber}>Day {day.dayNumber}</span>
          <span className={styles.title}>{day.displayTitle}</span>
        </div>
        <div className={styles.date}>{formatDayDate(day.calendarDate)}</div>
      </div>
      <div className={styles.right}>
        <span className={styles.totalChip}>{formatNZD(dayTotal)}</span>
        <button type="button" className={styles.addButton} onClick={onAddEntry}>
          + Add
        </button>
      </div>
    </header>
  );
};
