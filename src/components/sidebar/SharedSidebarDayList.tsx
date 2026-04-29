import * as React from 'react';
import type { TripDay } from '../../models/TripDay';
import { useTripWorkspace } from '../../context/TripWorkspaceContext';
import styles from './TripSidebar.module.css';
import itemStyles from './SidebarDayItem.module.css';

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

export const SharedSidebarDayList: React.FC = () => {
  const { trip, tripDays, selectedDayId, setSelectedDayId } = useTripWorkspace();

  const days = React.useMemo(() => {
    if (!trip) return [];
    return tripDays.filter((d) => d.tripId === trip.id && d.dayType !== 'PreTrip').sort((a, b) => a.dayNumber - b.dayNumber);
  }, [trip, tripDays]);

  React.useEffect(() => {
    if (!days.length) return;
    if (!days.some((d) => d.id === selectedDayId)) {
      setSelectedDayId(days[0].id);
    }
  }, [days, selectedDayId, setSelectedDayId]);

  return (
    <div className={styles.dayListSection}>
      <h2 className={styles.dayListHeading}>Days</h2>
      <ul className={styles.dayList}>
        {days.map((day) => {
          const dayDate = day.calendarDate
            ? new Date(day.calendarDate + 'T00:00:00').toLocaleDateString('en-NZ', {
                weekday: 'short',
                day: 'numeric',
                month: 'short'
              })
            : '';
          const badgeColorClass =
            day.dayType === 'PreTrip'
              ? itemStyles.badgePreTrip
              : day.dayType === 'Sea'
                ? itemStyles.badgeSea
                : day.dayType === 'TravelTransit'
                  ? itemStyles.badgeTransit
                  : itemStyles.badgePlacePort;
          const isSelected = day.id === selectedDayId;
          return (
            <li key={day.id} className={itemStyles.listItemWrap}>
              <button
                type="button"
                className={`${itemStyles.button} ${isSelected ? itemStyles.selected : ''}`}
                onClick={() => setSelectedDayId(day.id)}
                aria-current={isSelected ? 'true' : undefined}
              >
                <div className={itemStyles.row1}>
                  <span className={itemStyles.dayNumberLabel}>
                    {day.dayType === 'PreTrip' ? 'Pre-trip' : `Day ${day.dayNumber}${dayDate ? ` · ${dayDate}` : ''}`}
                  </span>
                  {day.dayType !== 'Sea' ? (
                    <span className={`${itemStyles.badge} ${badgeColorClass}`}>{dayTypeLabel(day.dayType)}</span>
                  ) : null}
                </div>
                <div className={itemStyles.row2}>
                  <span className={itemStyles.title}>{day.displayTitle}</span>
                </div>
              </button>
            </li>
          );
        })}
      </ul>
    </div>
  );
};
