import * as React from 'react';
import { useDroppable } from '@dnd-kit/core';
import type { TripDay } from '../../models/TripDay';
import { useConfig } from '../../context/ConfigContext';
import { useTripWorkspace } from '../../context/TripWorkspaceContext';
import { formatCurrency } from '../../utils/financialUtils';
import type { DayPlanningStatus } from '../../models/TripDay';
import { useTripPermissions } from '../../hooks/useTripPermissions';
import styles from './SidebarDayItem.module.css';

export interface SidebarDayItemProps {
  day: TripDay;
  isSelected: boolean;
  onSelect: () => void;
  dayTotal: number;
}

function dayTypeLabel(dayType: TripDay['dayType']): string {
  switch (dayType) {
    case 'Sea':
      return 'Sea day';
    case 'TravelTransit':
      return 'Transit';
    case 'PreTrip':
      return 'Pre-trip';
    case 'PlacePort':
    default:
      return 'Place / Port';
  }
}

export const SidebarDayItem: React.FC<SidebarDayItemProps> = ({ day, isSelected, onSelect, dayTotal }) => {
  const { config } = useConfig();
  const { updateDay } = useTripWorkspace();
  const { canEditDayMeta, canSeeFinancials } = useTripPermissions();
  const planningStatus: DayPlanningStatus = day.planningStatus ?? 'NotStarted';
  const { setNodeRef, isOver } = useDroppable({
    id: day.id,
    data: { type: 'day' },
    disabled: !canEditDayMeta
  });
  const [isEditingTitle, setIsEditingTitle] = React.useState(false);
  const [titleDraft, setTitleDraft] = React.useState(day.displayTitle);
  const [typePickerOpen, setTypePickerOpen] = React.useState(false);

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

  const badgeColorClass =
    day.dayType === 'PreTrip'
      ? styles.badgePreTrip
      : day.dayType === 'Sea'
        ? styles.badgeSea
        : day.dayType === 'TravelTransit'
          ? styles.badgeTransit
          : styles.badgePlacePort;

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
        data-sidebar-day-id={day.id}
        className={`${styles.button} ${isSelected ? styles.selected : ''} ${isOver ? styles.dropOver : ''}`}
        onClick={onSelect}
        aria-current={isSelected ? 'true' : undefined}
      >
        <div className={styles.row1}>
          <span className={styles.dayNumberLabel}>
            {day.dayType === 'PreTrip' ? 'Pre-trip' : `Day ${day.dayNumber}${dayDate ? ` · ${dayDate}` : ''}`}
          </span>
          <div className={styles.badgeWrap}>
            {canEditDayMeta ? (
            <button
              type="button"
              className={`${styles.badge} ${badgeColorClass}`}
              onClick={(e) => {
                e.stopPropagation();
                setTypePickerOpen((v) => !v);
              }}
            >
              {dayTypeLabel(day.dayType)}
            </button>
            ) : (
            <span className={`${styles.badge} ${badgeColorClass}`}>{dayTypeLabel(day.dayType)}</span>
            )}
            {canEditDayMeta && typePickerOpen ? (
              <div className={styles.badgeOptions} onClick={(e) => e.stopPropagation()}>
                {(['PlacePort', 'Sea', 'TravelTransit', 'PreTrip'] as const).map((option) => (
                  <button
                    key={option}
                    type="button"
                    className={`${styles.badgeOption} ${
                      option === 'PreTrip'
                        ? styles.badgePreTrip
                        : option === 'Sea'
                          ? styles.badgeSea
                          : option === 'TravelTransit'
                            ? styles.badgeTransit
                            : styles.badgePlacePort
                    }`}
                    onClick={() => {
                      updateDay(day.id, { dayType: option });
                      setTypePickerOpen(false);
                    }}
                  >
                    {dayTypeLabel(option)}
                  </button>
                ))}
              </div>
            ) : null}
          </div>
        </div>
        <div className={styles.row2}>
          {canEditDayMeta && isEditingTitle ? (
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
                if (!canEditDayMeta) return;
                e.stopPropagation();
                setIsEditingTitle(true);
              }}
            >
              {day.displayTitle}
            </span>
          )}
          {canSeeFinancials ? (
            <span className={styles.dayTotal}>{formatCurrency(dayTotal, config.homeCurrency)}</span>
          ) : null}
        </div>
        {canEditDayMeta ? (
        <div className={styles.row3} onClick={(e) => e.stopPropagation()}>
          <label className={styles.planningLabel}>
            Planning
            <select
              className={styles.planningSelect}
              value={planningStatus}
              onChange={(e) => {
                updateDay(day.id, { planningStatus: e.target.value as DayPlanningStatus });
              }}
            >
              <option value="NotStarted">Not started</option>
              <option value="InProgress">In progress</option>
              <option value="Complete">Complete</option>
            </select>
          </label>
        </div>
        ) : null}
      </button>
    </li>
  );
};
