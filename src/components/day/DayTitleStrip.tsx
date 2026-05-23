import * as React from 'react';
import type { TripDay } from '../../models/TripDay';
import { useTripWorkspace } from '../../context/TripWorkspaceContext';
import { formatDayDate } from '../../utils/dateUtils';
import styles from './DayHeader.module.css';

export interface DayTitleStripProps {
  day: TripDay;
  variant?: 'default' | 'shared';
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

/** Day number, editable title, type badge, and date only — for sticky itinerary chrome. */
export const DayTitleStrip: React.FC<DayTitleStripProps> = ({ day, variant = 'default' }) => {
  const { updateDay } = useTripWorkspace();
  const isShared = variant === 'shared';
  const [isEditingTitle, setIsEditingTitle] = React.useState(false);
  const [titleDraft, setTitleDraft] = React.useState(day.displayTitle);
  const [typePickerOpen, setTypePickerOpen] = React.useState(false);

  React.useEffect(() => {
    setTitleDraft(day.displayTitle);
  }, [day.displayTitle]);

  const saveTitle = React.useCallback(() => {
    const trimmed = titleDraft.trim();
    if (trimmed && trimmed !== day.displayTitle) {
      updateDay(day.id, { displayTitle: trimmed });
    }
    setIsEditingTitle(false);
  }, [day.displayTitle, day.id, titleDraft, updateDay]);

  const cancelTitle = React.useCallback(() => {
    setTitleDraft(day.displayTitle);
    setIsEditingTitle(false);
  }, [day.displayTitle]);

  const dayTypeClass =
    day.dayType === 'PreTrip'
      ? styles.badgePreTrip
      : day.dayType === 'Sea'
        ? styles.badgeSea
        : day.dayType === 'TravelTransit'
          ? styles.badgeTransit
          : styles.badgePlacePort;

  return (
    <div className={styles.titleBlock}>
      <div className={styles.line1}>
        <span className={styles.dayNumber}>Day {day.dayNumber}</span>
        {isShared ? (
          <span className={styles.titleReadonly}>{day.displayTitle}</span>
        ) : isEditingTitle ? (
          <input
            className={styles.titleInput}
            value={titleDraft}
            onChange={(e) => setTitleDraft(e.target.value)}
            onBlur={saveTitle}
            onKeyDown={(e) => {
              if (e.key === 'Enter') saveTitle();
              if (e.key === 'Escape') cancelTitle();
            }}
            autoFocus
          />
        ) : (
          <button type="button" className={styles.titleButton} onClick={() => setIsEditingTitle(true)}>
            {day.displayTitle}
          </button>
        )}
        <div className={styles.dayTypeWrap}>
          {isShared ? (
            <span className={`${styles.dayTypeBadge} ${dayTypeClass}`}>{dayTypeLabel(day.dayType)}</span>
          ) : (
            <>
              <button
                type="button"
                className={`${styles.dayTypeBadge} ${dayTypeClass}`}
                onClick={() => setTypePickerOpen((v) => !v)}
              >
                {dayTypeLabel(day.dayType)}
              </button>
              {typePickerOpen ? (
                <div className={styles.dayTypeOptions}>
                  {(['PlacePort', 'Sea', 'TravelTransit', 'PreTrip'] as const).map((option) => (
                    <button
                      key={option}
                      type="button"
                      className={`${styles.dayTypeOption} ${
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
            </>
          )}
        </div>
      </div>
      <div className={styles.date}>
        {day.dayType === 'PreTrip' ? 'Before trip starts' : formatDayDate(day.calendarDate)}
      </div>
    </div>
  );
};
