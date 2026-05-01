import * as React from 'react';
import { useTripWorkspace } from '../../context/TripWorkspaceContext';
import { sumForDay } from '../../utils/financialUtils';
import { TRAVELHUB_SIDEBAR_FOCUS_DAY } from '../../utils/sidebarDayFocus';
import { SidebarDayItem } from './SidebarDayItem';
import styles from './TripSidebar.module.css';

export const SidebarDayList: React.FC = () => {
  const { trip, tripDays, selectedDayId, setSelectedDayId, localEntries, convertToHomeCurrency } = useTripWorkspace();

  const days = React.useMemo(() => {
    if (!trip) return [];
    return tripDays
      .filter((d) => d.tripId === trip.id)
      .sort((a, b) => a.dayNumber - b.dayNumber);
  }, [trip, tripDays]);

  const entries = React.useMemo(
    () => (trip ? localEntries.filter((e) => e.tripId === trip.id) : []),
    [localEntries, trip]
  );

  React.useEffect(() => {
    const onFocusDay = (ev: Event): void => {
      const ce = ev as CustomEvent<{ dayId?: string }>;
      const dayId = (ce.detail?.dayId || '').trim();
      if (!dayId) return;
      setSelectedDayId(dayId);
      window.requestAnimationFrame(() => {
        const el = document.querySelector<HTMLElement>(`[data-sidebar-day-id="${dayId}"]`);
        el?.scrollIntoView({ block: 'nearest', inline: 'nearest', behavior: 'smooth' });
      });
    };
    window.addEventListener(TRAVELHUB_SIDEBAR_FOCUS_DAY, onFocusDay as EventListener);
    return () => window.removeEventListener(TRAVELHUB_SIDEBAR_FOCUS_DAY, onFocusDay as EventListener);
  }, [setSelectedDayId]);

  return (
    <div className={styles.dayListSection}>
      <h2 className={styles.dayListHeading}>Days</h2>
      <ul className={styles.dayList}>
        {days.map((day) => (
          <SidebarDayItem
            key={day.id}
            day={day}
            isSelected={day.id === selectedDayId}
            onSelect={() => setSelectedDayId(day.id)}
            dayTotal={sumForDay(entries, day.id, convertToHomeCurrency, day.calendarDate)}
          />
        ))}
      </ul>
    </div>
  );
};
