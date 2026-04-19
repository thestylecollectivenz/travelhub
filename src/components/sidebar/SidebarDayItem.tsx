import * as React from 'react';
import type { TripDay } from '../../models/TripDay';
import { formatNZD } from '../../utils/financialUtils';
import styles from './SidebarDayItem.module.css';

export interface SidebarDayItemProps {
  day: TripDay;
  isSelected: boolean;
  onSelect: () => void;
  dayTotal: number;
}

export const SidebarDayItem: React.FC<SidebarDayItemProps> = ({ day, isSelected, onSelect, dayTotal }) => {
  const badge =
    day.dayType === 'Sea' ? (
      <span className={`${styles.badge} ${styles.badgeSea}`}>Sea</span>
    ) : day.dayType === 'TravelTransit' ? (
      <span className={`${styles.badge} ${styles.badgeTransit}`}>Transit</span>
    ) : null;

  return (
    <li className={styles.listItemWrap}>
      <button
        type="button"
        className={`${styles.button} ${isSelected ? styles.selected : ''}`}
        onClick={onSelect}
        aria-current={isSelected ? 'true' : undefined}
      >
        <div className={styles.row1}>
          <span className={styles.dayNumberLabel}>Day {day.dayNumber}</span>
          {badge}
        </div>
        <div className={styles.row2}>
          <span className={styles.title}>{day.displayTitle}</span>
          <span className={styles.dayTotal}>{formatNZD(dayTotal)}</span>
        </div>
      </button>
    </li>
  );
};
