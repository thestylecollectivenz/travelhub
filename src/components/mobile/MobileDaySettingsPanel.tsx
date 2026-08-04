import * as React from 'react';
import { createPortal } from 'react-dom';
import type { TripDay, DayPlanningStatus, TripDayType } from '../../models/TripDay';
import { useTripWorkspace } from '../../context/TripWorkspaceContext';
import { formatDayDate } from '../../utils/dateUtils';
import { DayLocationsEditor } from '../day/DayLocationsEditor';
import styles from './MobileDaySettingsPanel.module.css';

export interface MobileDaySettingsPanelProps {
  day: TripDay | null;
  isOpen: boolean;
  onClose: () => void;
}

function dayTypeLabel(dayType: TripDayType): string {
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

const DAY_TYPES: TripDayType[] = ['PlacePort', 'Sea', 'TravelTransit', 'PreTrip'];

export const MobileDaySettingsPanel: React.FC<MobileDaySettingsPanelProps> = ({ day, isOpen, onClose }) => {
  const { updateDay } = useTripWorkspace();
  const [titleDraft, setTitleDraft] = React.useState(day?.displayTitle ?? '');

  React.useEffect(() => {
    if (isOpen && day) {
      setTitleDraft(day.displayTitle);
    }
  }, [isOpen, day?.id, day?.displayTitle]);

  const saveTitle = React.useCallback(() => {
    if (!day) return;
    const next = titleDraft.trim();
    if (!next || next === day.displayTitle) {
      setTitleDraft(day.displayTitle);
      return;
    }
    updateDay(day.id, { displayTitle: next });
  }, [day, titleDraft, updateDay]);

  if (!isOpen || !day) return null;

  const planningStatus: DayPlanningStatus = day.planningStatus ?? 'NotStarted';

  return createPortal(
    <div
      className={styles.backdrop}
      role="presentation"
      onClick={(e) => {
        if (e.target === e.currentTarget) {
          saveTitle();
          onClose();
        }
      }}
    >
      <aside
        className={styles.sheet}
        role="dialog"
        aria-modal="true"
        aria-label={`Day ${day.dayNumber} settings`}
        onClick={(e) => e.stopPropagation()}
      >
        <div className={styles.header}>
          <div className={styles.headerText}>
            <p className={styles.kicker}>Day {day.dayNumber} settings</p>
            <p className={styles.dateLine}>
              {day.dayType === 'PreTrip' ? 'Before trip starts' : formatDayDate(day.calendarDate)}
            </p>
          </div>
          <button
            type="button"
            className={styles.closeBtn}
            aria-label="Close day settings"
            onClick={() => {
              saveTitle();
              onClose();
            }}
          >
            ×
          </button>
        </div>

        <label className={styles.field}>
          <span className={styles.fieldLabel}>Day name</span>
          <input
            className={styles.titleInput}
            value={titleDraft}
            onChange={(e) => setTitleDraft(e.target.value)}
            onBlur={saveTitle}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault();
                (e.target as HTMLInputElement).blur();
              }
            }}
            placeholder="Day display title"
            autoComplete="off"
          />
        </label>

        <label className={styles.field}>
          <span className={styles.fieldLabel}>Day type</span>
          <select
            className={styles.select}
            value={day.dayType}
            onChange={(e) => updateDay(day.id, { dayType: e.target.value as TripDayType })}
          >
            {DAY_TYPES.map((t) => (
              <option key={t} value={t}>
                {dayTypeLabel(t)}
              </option>
            ))}
          </select>
        </label>

        <label className={styles.field}>
          <span className={styles.fieldLabel}>Day planning</span>
          <select
            className={styles.select}
            value={planningStatus}
            onChange={(e) => updateDay(day.id, { planningStatus: e.target.value as DayPlanningStatus })}
          >
            <option value="NotStarted">Not started</option>
            <option value="InProgress">In progress</option>
            <option value="Complete">Complete</option>
          </select>
        </label>

        <div className={styles.locationsBlock}>
          <DayLocationsEditor day={day} hideDone />
        </div>
      </aside>
    </div>,
    document.body
  );
};
