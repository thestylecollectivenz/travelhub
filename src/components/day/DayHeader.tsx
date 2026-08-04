import * as React from 'react';
import type { TripDay } from '../../models/TripDay';
import { useTripWorkspace } from '../../context/TripWorkspaceContext';
import { usePlaces } from '../../context/PlacesContext';
import { formatDayDate } from '../../utils/dateUtils';
import type { DayPlanningStatus } from '../../models/TripDay';
import { DayLocationsEditor, locationsSummaryForDay } from './DayLocationsEditor';
import styles from './DayHeader.module.css';

export interface DayHeaderProps {
  day: TripDay;
  /** Shared / read-only: no inline edits. */
  variant?: 'default' | 'shared';
  /** When true, only the day title row stays sticky while scrolling (not locations or place info). */
  stickyTitleOnly?: boolean;
  activePlaceInfoId?: string;
  onActivePlaceInfoChange?: (placeId: string) => void;
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

export const DayHeader: React.FC<DayHeaderProps> = ({
  day,
  variant = 'default',
  stickyTitleOnly = false,
  activePlaceInfoId: controlledActivePlaceInfoId,
  onActivePlaceInfoChange
}) => {
  const { updateDay } = useTripWorkspace();
  const { placeById } = usePlaces();
  const isShared = variant === 'shared';
  const [isEditingTitle, setIsEditingTitle] = React.useState(false);
  const [titleDraft, setTitleDraft] = React.useState(day.displayTitle);
  const [typePickerOpen, setTypePickerOpen] = React.useState(false);
  const [locationsExpanded, setLocationsExpanded] = React.useState(false);
  const planningStatus: DayPlanningStatus = day.planningStatus ?? 'NotStarted';

  const locationsSummary = React.useMemo(
    () => locationsSummaryForDay(day, placeById),
    [day, placeById]
  );

  React.useEffect(() => {
    setTitleDraft(day.displayTitle);
  }, [day.displayTitle]);

  React.useEffect(() => {
    const onExpandLocations = (ev: Event): void => {
      const dayId = (ev as CustomEvent<{ dayId?: string }>).detail?.dayId;
      if (!dayId || dayId !== day.id) return;
      setLocationsExpanded(true);
    };
    window.addEventListener('travelhub-expand-day-locations', onExpandLocations as EventListener);
    return () => window.removeEventListener('travelhub-expand-day-locations', onExpandLocations as EventListener);
  }, [day.id]);

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

  const dayTypeClass =
    day.dayType === 'PreTrip'
      ? styles.badgePreTrip
      : day.dayType === 'Sea'
        ? styles.badgeSea
        : day.dayType === 'TravelTransit'
          ? styles.badgeTransit
          : styles.badgePlacePort;

  return (
    <header className={`${styles.bar} ${stickyTitleOnly ? styles.barLocationsOnly : ''}`}>
      {stickyTitleOnly ? null : (
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
            {!stickyTitleOnly ? (
              <div className={styles.line1Right}>
                <button
                  type="button"
                  className={styles.locationsInlineBtn}
                  onClick={() => setLocationsExpanded((v) => !v)}
                  aria-expanded={locationsExpanded}
                >
                  <span className={styles.locationsInlineLabel}>Edit locations</span>
                  <span className={styles.locationsInlineSummary}>{locationsSummary}</span>
                </button>
              </div>
            ) : null}
          </div>
          <div className={styles.date}>
            {day.dayType === 'PreTrip' ? 'Before trip starts' : formatDayDate(day.calendarDate)}
          </div>
          {!isShared ? (
            <label className={styles.planningRow}>
              Day planning
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
          ) : null}
        </div>
      )}
      {locationsExpanded ? (
        <DayLocationsEditor
          day={day}
          readOnly={isShared}
          onDone={() => setLocationsExpanded(false)}
          activePlaceInfoId={controlledActivePlaceInfoId}
          onActivePlaceInfoChange={onActivePlaceInfoChange}
        />
      ) : null}
    </header>
  );
};
