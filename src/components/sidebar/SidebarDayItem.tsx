import * as React from 'react';
import { useDroppable } from '@dnd-kit/core';
import type { TripDay } from '../../models/TripDay';
import { useConfig } from '../../context/ConfigContext';
import { useTripWorkspace } from '../../context/TripWorkspaceContext';
import { formatCurrency } from '../../utils/financialUtils';
import styles from './SidebarDayItem.module.css';

export interface SidebarDayItemProps {
  day: TripDay;
  isSelected: boolean;
  onSelect: () => void;
  dayTotal: number;
}

export const SidebarDayItem: React.FC<SidebarDayItemProps> = ({ day, isSelected, onSelect, dayTotal }) => {
  const { config } = useConfig();
  const { updateDay } = useTripWorkspace();
  const { setNodeRef, isOver } = useDroppable({
    id: day.id,
    data: { type: 'day' }
  });
  const [isEditingTitle, setIsEditingTitle] = React.useState(false);
  const [titleDraft, setTitleDraft] = React.useState(day.displayTitle);

  React.useEffect(() => {
    setTitleDraft(day.displayTitle);
  }, [day.displayTitle]);

  const saveTitle = React.useCallback(() => {
    const next = titleDraft.trim();
    if (!next || next === day.displayTitle) {
      setTitleDraft(day.displayTitle);
      setIsEditingTitle(false);
      return;
    }
    updateDay(day.id, { displayTitle: next });
    setIsEditingTitle(false);
  }, [day.displayTitle, day.id, titleDraft, updateDay]);

  const cancelTitle = React.useCallback(() => {
    setTitleDraft(day.displayTitle);
    setIsEditingTitle(false);
  }, [day.displayTitle]);

  const badge =
    day.dayType === 'PreTrip' ? (
      <span className={`${styles.badge} ${styles.badgePreTrip}`}>Pre-trip</span>
    ) : day.dayType === 'Sea' ? (
      <span className={`${styles.badge} ${styles.badgeSea}`}>Sea</span>
    ) : day.dayType === 'TravelTransit' ? (
      <span className={`${styles.badge} ${styles.badgeTransit}`}>Transit</span>
    ) : null;

  const dayDate = day.calendarDate
    ? new Date(day.calendarDate + 'T00:00:00').toLocaleDateString('en-NZ', {
        weekday: 'short',
        day: 'numeric',
        month: 'short'
      })
    : '';

  return (
    <li className={styles.listItemWrap}>
      <button
        ref={setNodeRef}
        type="button"
        className={`${styles.button} ${isSelected ? styles.selected : ''} ${isOver ? styles.dropOver : ''}`}
        onClick={onSelect}
        aria-current={isSelected ? 'true' : undefined}
      >
        <div className={styles.row1}>
          <span className={styles.dayNumberLabel}>
            {day.dayType === 'PreTrip' ? 'Pre-trip' : `Day ${day.dayNumber}${dayDate ? ` · ${dayDate}` : ''}`}
          </span>
          {badge}
        </div>
        <div className={styles.row2}>
          {isEditingTitle ? (
            <input
              className={styles.titleInput}
              value={titleDraft}
              onChange={(e) => setTitleDraft(e.target.value)}
              onBlur={saveTitle}
              onKeyDown={(e) => {
                if (e.key === 'Enter') saveTitle();
                if (e.key === 'Escape') cancelTitle();
              }}
              onClick={(e) => e.stopPropagation()}
              autoFocus
            />
          ) : (
            <span
              className={styles.title}
              onClick={(e) => {
                e.stopPropagation();
                setIsEditingTitle(true);
              }}
            >
              {day.displayTitle}
            </span>
          )}
          <span className={styles.dayTotal}>{formatCurrency(dayTotal, config.homeCurrency)}</span>
        </div>
      </button>
    </li>
  );
};
