import * as React from 'react';
import { DndContext, DragOverlay, type DragEndEvent, type DragStartEvent, closestCenter } from '@dnd-kit/core';
import { arrayMove } from '@dnd-kit/sortable';
import { DayPanel } from '../day/DayPanel';
import { TripJournalFeed } from '../journal/TripJournalFeed';
import { TripPhotoAlbum } from '../journal/TripPhotoAlbum';
import { TripFilesLinksView } from '../documents/TripFilesLinksView';
import { TripMap } from '../maps/TripMap';
import { ErrorBoundary } from '../shared/ErrorBoundary';
import { TripTasksView } from '../tasks/TripTasksView';
import { PackingListView } from '../packing/PackingListView';
import { TripSidebar } from '../sidebar/TripSidebar';
import { type MainWorkspaceTab, useTripWorkspace } from '../../context/TripWorkspaceContext';
import { isPreTripDayRow, resolvePreTripDayId, sortEntriesForDay } from '../../utils/itineraryDayEntries';
import { applyDayViewEntryOrder, saveDayViewEntryOrder } from '../../utils/dayViewEntryOrder';
import { orderIdsByHomeDayFromVisualList } from '../../utils/itineraryReorderByDay';
import { useConfig } from '../../context/ConfigContext';
import dayHeaderStyles from '../day/DayHeader.module.css';
import styles from './TripWorkspace.module.css';

function formatMobileDayDate(value: string): string {
  if (!value) return '';
  return new Date(`${value}T12:00:00`).toLocaleDateString('en-NZ', {
    weekday: 'short',
    day: 'numeric',
    month: 'short'
  });
}

export const TripContent: React.FC = () => {
  const { trip, tripDays, selectedDayId, setSelectedDayId, localEntries, reorderEntries, moveEntryToDay, mainWorkspaceTab, setMainWorkspaceTab } = useTripWorkspace();
  const { config, saveConfig } = useConfig();
  const [activeId, setActiveId] = React.useState<string | null>(null);
  const [planTab, setPlanTab] = React.useState<'tasks' | 'packing'>('tasks');
  const [sidebarWidth, setSidebarWidth] = React.useState<number>(config.sidebarWidth || 260);
  const sidebarWidthRef = React.useRef(sidebarWidth);
  const saveTimerRef = React.useRef<number | null>(null);
  const isDraggingRef = React.useRef(false);

  React.useEffect(() => {
    if (isDraggingRef.current) return;
    setSidebarWidth(config.sidebarWidth || 260);
  }, [config.sidebarWidth]);
  React.useEffect(() => {
    sidebarWidthRef.current = sidebarWidth;
  }, [sidebarWidth]);

  const dayPanelDay = React.useMemo(() => {
    if (!trip || !selectedDayId) return undefined;
    return tripDays.find((x) => x.id === selectedDayId && x.tripId === trip.id);
  }, [trip, tripDays, selectedDayId]);

  const mobileDays = React.useMemo(() => {
    if (!trip) return [];
    return tripDays
      .filter((day) => day.tripId === trip.id)
      .sort((a, b) => a.dayNumber - b.dayNumber);
  }, [trip, tripDays]);

  const selectedDayIndex = React.useMemo(
    () => mobileDays.findIndex((day) => day.id === selectedDayId),
    [mobileDays, selectedDayId]
  );

  const todayDay = React.useMemo(() => {
    const todayIso = new Date().toISOString().slice(0, 10);
    return mobileDays.find((day) => day.calendarDate === todayIso);
  }, [mobileDays]);

  const selectRelativeMobileDay = React.useCallback(
    (delta: number): void => {
      if (!mobileDays.length) return;
      const fallbackIndex = selectedDayIndex >= 0 ? selectedDayIndex : 0;
      const nextIndex = Math.max(0, Math.min(mobileDays.length - 1, fallbackIndex + delta));
      setSelectedDayId(mobileDays[nextIndex].id);
    },
    [mobileDays, selectedDayIndex, setSelectedDayId]
  );

  const preTripDayId = React.useMemo(() => resolvePreTripDayId(tripDays, trip?.id ?? ''), [tripDays, trip?.id]);

  const dayEntries = React.useMemo(() => {
    if (!trip || !selectedDayId || !dayPanelDay) return [];
    const cal = dayPanelDay.calendarDate ?? '';
    const raw = sortEntriesForDay(
      localEntries,
      selectedDayId,
      cal,
      dayPanelDay.dayType,
      preTripDayId,
      isPreTripDayRow(dayPanelDay),
      tripDays
    );
    return applyDayViewEntryOrder(trip.id, selectedDayId, raw, cal, tripDays);
  }, [localEntries, selectedDayId, dayPanelDay, trip, preTripDayId, tripDays]);

  const activeEntry = React.useMemo(() => {
    if (!activeId) {
      return undefined;
    }
    return localEntries.find((entry) => entry.id === activeId);
  }, [activeId, localEntries]);

  const handleDragStart = React.useCallback((event: DragStartEvent): void => {
    setActiveId(String(event.active.id));
  }, []);

  const handleDragEnd = React.useCallback(
    (event: DragEndEvent): void => {
      const { active, over } = event;
      setActiveId(null);
      if (!over) {
        return;
      }

      if (over.data.current?.type === 'day') {
        moveEntryToDay(String(active.id), String(over.id));
        return;
      }

      if (active.id !== over.id) {
        const oldIndex = dayEntries.findIndex((e) => e.id === active.id);
        const newIndex = dayEntries.findIndex((e) => e.id === over.id);
        if (oldIndex < 0 || newIndex < 0) {
          return;
        }
        if (!trip || !selectedDayId) {
          return;
        }
        let reordered = arrayMove(dayEntries, oldIndex, newIndex);
        const movingEntry = localEntries.find((e) => e.id === String(active.id));
        if (
          movingEntry &&
          movingEntry.category === 'Accommodation' &&
          selectedDayId &&
          movingEntry.dayId !== selectedDayId
        ) {
          moveEntryToDay(movingEntry.id, selectedDayId);
          reordered = reordered.map((entry) =>
            entry.id === movingEntry.id ? { ...entry, dayId: selectedDayId } : entry
          );
        }
        saveDayViewEntryOrder(trip.id, selectedDayId, reordered.map((e) => e.id));
        const byDay = orderIdsByHomeDayFromVisualList(reordered);
        for (const [dayId, ids] of Array.from(byDay.entries())) {
          reorderEntries(dayId, ids);
        }
      }
    },
    [dayEntries, localEntries, moveEntryToDay, reorderEntries, selectedDayId, trip]
  );

  const startSidebarResize = React.useCallback(
    (event: React.MouseEvent<HTMLDivElement>) => {
      event.preventDefault();
      const startX = event.clientX;
      const startWidth = sidebarWidth;

      const onMouseMove = (moveEvent: MouseEvent): void => {
        const delta = moveEvent.clientX - startX;
        const nextWidth = Math.max(180, Math.min(400, startWidth + delta));
        setSidebarWidth(nextWidth);
      };

      const onMouseUp = (): void => {
        window.removeEventListener('mousemove', onMouseMove);
        window.removeEventListener('mouseup', onMouseUp);
        isDraggingRef.current = false;
        if (saveTimerRef.current) {
          window.clearTimeout(saveTimerRef.current);
        }
        const finalWidth = Math.max(180, Math.min(400, sidebarWidthRef.current));
        saveTimerRef.current = window.setTimeout(() => {
          saveConfig({ ...config, sidebarWidth: finalWidth }).catch(console.error);
        }, 300);
      };

      isDraggingRef.current = true;
      window.addEventListener('mousemove', onMouseMove);
      window.addEventListener('mouseup', onMouseUp);
    },
    [config, saveConfig]
  );

  const shell = (
    <div className={styles.tripContent}>
      <div className={styles.sidebarShell} style={{ width: `${sidebarWidth}px` }}>
        <aside className={styles.sidebar} aria-label="Trip navigation and budget">
          <TripSidebar />
        </aside>
        <div
          className={styles.sidebarResizeHandle}
          role="separator"
          aria-orientation="vertical"
          aria-label="Resize sidebar"
          onMouseDown={startSidebarResize}
        />
      </div>
      {mainWorkspaceTab === 'itinerary' && mobileDays.length ? (
        <nav className={styles.mobileDayPicker} aria-label="Mobile day navigation">
          <div className={styles.mobileDayPickerHeader}>
            <button
              type="button"
              className={styles.mobileDayStep}
              onClick={() => selectRelativeMobileDay(-1)}
              disabled={selectedDayIndex <= 0}
              aria-label="Previous day"
            >
              Prev
            </button>
            <div className={styles.mobileDayPickerTitle}>
              <span>{selectedDayIndex >= 0 ? `Day ${mobileDays[selectedDayIndex].dayNumber}` : 'Select day'}</span>
              {selectedDayIndex >= 0 ? <small>{formatMobileDayDate(mobileDays[selectedDayIndex].calendarDate)}</small> : null}
            </div>
            <button
              type="button"
              className={styles.mobileDayStep}
              onClick={() => selectRelativeMobileDay(1)}
              disabled={selectedDayIndex < 0 || selectedDayIndex >= mobileDays.length - 1}
              aria-label="Next day"
            >
              Next
            </button>
          </div>
          <div className={styles.mobileDayScroller} role="tablist" aria-label="Trip days">
            {todayDay ? (
              <button
                type="button"
                className={`${styles.mobileTodayChip} ${todayDay.id === selectedDayId ? styles.mobileDayChipActive : ''}`}
                onClick={() => setSelectedDayId(todayDay.id)}
              >
                Today
              </button>
            ) : null}
            {mobileDays.map((day) => (
              <button
                key={day.id}
                type="button"
                role="tab"
                aria-selected={day.id === selectedDayId}
                className={`${styles.mobileDayChip} ${day.id === selectedDayId ? styles.mobileDayChipActive : ''}`}
                onClick={() => setSelectedDayId(day.id)}
              >
                <span>Day {day.dayNumber}</span>
                <small>{day.displayTitle}</small>
              </button>
            ))}
          </div>
        </nav>
      ) : null}
      <main className={styles.main}>
        {mainWorkspaceTab === 'itinerary' ? <DayPanel /> : null}
        {mainWorkspaceTab === 'journal' ? <TripJournalFeed /> : null}
        {mainWorkspaceTab === 'photos' ? <TripPhotoAlbum /> : null}
        {mainWorkspaceTab === 'files' ? <TripFilesLinksView /> : null}
        {mainWorkspaceTab === 'map' ? (
          <ErrorBoundary fallbackTitle="Map could not load">
            <TripMap />
          </ErrorBoundary>
        ) : null}
        {mainWorkspaceTab === 'plan' ? (
          <section style={{ padding: 'var(--space-4)', display: 'grid', gap: 'var(--space-3)' }}>
            <div style={{ display: 'inline-flex', gap: 'var(--space-2)', flexWrap: 'wrap' }}>
              <button
                type="button"
                className={dayHeaderStyles.journalButton}
                style={planTab === 'tasks' ? { borderColor: 'var(--color-primary)', boxShadow: '0 0 0 1px var(--color-primary)' } : undefined}
                onClick={() => setPlanTab('tasks')}
              >
                Tasks
              </button>
              <button
                type="button"
                className={dayHeaderStyles.journalButton}
                style={planTab === 'packing' ? { borderColor: 'var(--color-primary)', boxShadow: '0 0 0 1px var(--color-primary)' } : undefined}
                onClick={() => setPlanTab('packing')}
              >
                Packing
              </button>
            </div>
            {planTab === 'tasks' ? <TripTasksView /> : <PackingListView />}
          </section>
        ) : null}
      </main>
      <nav className={styles.mobileBottomNav} aria-label="Mobile workspace navigation">
        {([
          ['itinerary', 'Today'],
          ['map', 'Map'],
          ['journal', 'Journal'],
          ['photos', 'Photos'],
          ['files', 'Files'],
          ['plan', 'More']
        ] as Array<[MainWorkspaceTab, string]>).map(([tab, label]) => (
          <button
            key={tab}
            type="button"
            className={`${styles.mobileBottomNavButton} ${mainWorkspaceTab === tab ? styles.mobileBottomNavButtonActive : ''}`}
            aria-current={mainWorkspaceTab === tab ? 'page' : undefined}
            onClick={() => setMainWorkspaceTab(tab)}
          >
            <span className={styles.mobileBottomNavIcon} aria-hidden>
              {tab === 'itinerary' ? 'T' : tab === 'map' ? 'M' : tab === 'journal' ? 'J' : tab === 'photos' ? 'P' : tab === 'files' ? 'F' : '+'}
            </span>
            <span>{label}</span>
          </button>
        ))}
      </nav>
    </div>
  );

  if (mainWorkspaceTab !== 'itinerary') {
    return shell;
  }

  return (
    <DndContext collisionDetection={closestCenter} onDragStart={handleDragStart} onDragEnd={handleDragEnd}>
      {shell}
      {/* Must stay mounted for drop animations; portal wrapper can cover the page and print blank — hide in @media print */}
      <DragOverlay className={styles.dragOverlayPrintRoot}>
        {activeEntry ? (
          <div className={styles.dragOverlayCard}>
            <div className={styles.dragOverlayTitle}>{activeEntry.title || 'Untitled'}</div>
          </div>
        ) : null}
      </DragOverlay>
    </DndContext>
  );
};
