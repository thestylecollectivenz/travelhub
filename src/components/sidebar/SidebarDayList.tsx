import * as React from 'react';
import { useTripWorkspace } from '../../context/TripWorkspaceContext';
import { sumForDay } from '../../utils/financialUtils';
import { isPreTripDayRow } from '../../utils/itineraryDayEntries';
import { compareTripDaysChronological } from '../../utils/tripDateRangeSync';
import { TRAVELHUB_SIDEBAR_FOCUS_DAY } from '../../utils/sidebarDayFocus';
import { requestJournalDayScroll, requestPhotosDayScroll } from '../../utils/contentScroll';
import { SidebarDayItem } from './SidebarDayItem';
import styles from './TripSidebar.module.css';

export const SidebarDayList: React.FC = () => {
  const { trip, tripDays, selectedDayId, setSelectedDayId, localEntries, convertToHomeCurrency, mainWorkspaceTab } =
    useTripWorkspace();
  const [journalLayout, setJournalLayout] = React.useState<'all' | 'by-day'>('all');

  React.useEffect(() => {
    const onLayout = (ev: Event): void => {
      const layout = (ev as CustomEvent<{ layout?: 'all' | 'by-day' }>).detail?.layout;
      if (layout === 'all' || layout === 'by-day') setJournalLayout(layout);
    };
    window.addEventListener('travelhub-journal-layout', onLayout as EventListener);
    return () => window.removeEventListener('travelhub-journal-layout', onLayout as EventListener);
  }, []);

  const days = React.useMemo(() => {
    if (!trip) return [];
    return tripDays.filter((d) => d.tripId === trip.id).sort(compareTripDaysChronological);
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
            isSelected={
              mainWorkspaceTab === 'journal' && journalLayout === 'all' ? false : day.id === selectedDayId
            }
            onSelect={() => {
              setSelectedDayId(day.id);
              if (mainWorkspaceTab === 'journal') {
                window.dispatchEvent(
                  new CustomEvent('travelhub-journal-layout', { detail: { layout: 'by-day' as const } })
                );
                requestJournalDayScroll(day.id);
              }
              if (mainWorkspaceTab === 'photos') requestPhotosDayScroll(day.id);
            }}
            dayTotal={sumForDay(
              entries,
              day.id,
              convertToHomeCurrency,
              day.calendarDate,
              isPreTripDayRow(day)
            )}
          />
        ))}
      </ul>
    </div>
  );
};
