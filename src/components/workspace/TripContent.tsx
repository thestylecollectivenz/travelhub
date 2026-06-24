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
import { TripBudgetDetailView } from '../budget/TripBudgetDetailView';
import { PackingListView } from '../packing/PackingListView';
import { PackingTemplatesManager } from '../packing/PackingTemplatesManager';
import { TripSidebar } from '../sidebar/TripSidebar';
import { useTripWorkspace } from '../../context/TripWorkspaceContext';
import {
  expandTimelineDisplayRows,
  isPreTripDayRow,
  resolvePreTripDayId,
  sortEntriesForDay
} from '../../utils/itineraryDayEntries';
import {
  applyDayViewEntryOrder,
  applyDayViewTimelineRowOrder,
  entriesFromTimelineRowOrder,
  saveDayViewEntryOrder,
  saveDayViewTimelineRowOrder,
  timelineRowKeyToEntryId
} from '../../utils/dayViewEntryOrder';
import { orderIdsByHomeDayFromVisualList } from '../../utils/itineraryReorderByDay';
import { useConfig } from '../../context/ConfigContext';
import {
  markSidebarWidthCustomized,
  PRIVATE_WORKSPACE_TAB_COUNT,
  resolveSidebarWidthPx
} from '../../utils/sidebarWidth';
import { PlanViewProvider, usePlanView } from '../../context/PlanViewContext';
import { DayTitleStrip } from '../day/DayTitleStrip';
import { PaneCollapseToggle } from '../layout/PaneCollapseToggle';
import { RightPane, type RightPaneMode } from '../layout/RightPane';
import dayHeaderStyles from '../day/DayHeader.module.css';
import { useMinViewportWidth } from '../../utils/useMinViewportWidth';
import {
  defaultRightPaneWidthPx,
  DESKTOP_LAYOUT_MIN_PX,
  LEFT_PANE_MAX_PX,
  LEFT_PANE_MIN_PX,
  LS_LEFT_COLLAPSED,
  LS_RIGHT_COLLAPSED,
  LS_RIGHT_WIDTH,
  PANE_COLLAPSED_WIDTH_PX,
  readBool,
  readPaneWidth,
  RIGHT_PANE_MAX_PX,
  RIGHT_PANE_MIN_PX,
  writeBool,
  writePaneWidth
} from '../../utils/workspacePaneLayout';
import styles from './TripWorkspace.module.css';

const TripContentInner: React.FC = () => {
  const { trip, tripDays, selectedDayId, localEntries, reorderEntries, moveEntryToDay, mainWorkspaceTab } = useTripWorkspace();
  const { config, saveConfig } = useConfig();
  const [activeId, setActiveId] = React.useState<string | null>(null);
  const planView = usePlanView();
  const showDesktopRightPane = useMinViewportWidth(DESKTOP_LAYOUT_MIN_PX);

  const [sidebarWidth, setSidebarWidth] = React.useState<number>(() =>
    resolveSidebarWidthPx(config, PRIVATE_WORKSPACE_TAB_COUNT)
  );
  const [leftPaneCollapsed, setLeftPaneCollapsed] = React.useState<boolean>(() => readBool(LS_LEFT_COLLAPSED));
  const [rightPaneWidth, setRightPaneWidth] = React.useState<number>(() =>
    readPaneWidth(LS_RIGHT_WIDTH, defaultRightPaneWidthPx(), RIGHT_PANE_MIN_PX, RIGHT_PANE_MAX_PX)
  );
  const [rightPaneCollapsed, setRightPaneCollapsed] = React.useState<boolean>(() => readBool(LS_RIGHT_COLLAPSED));
  const [activePlaceInfoId, setActivePlaceInfoId] = React.useState('');
  const sidebarWidthRef = React.useRef(sidebarWidth);
  const rightPaneWidthRef = React.useRef(rightPaneWidth);
  const saveTimerRef = React.useRef<number | null>(null);
  const rightPaneSaveTimerRef = React.useRef<number | null>(null);
  const isDraggingRef = React.useRef(false);
  const isRightPaneDraggingRef = React.useRef(false);

  React.useEffect(() => {
    if (isDraggingRef.current) return;
    setSidebarWidth(resolveSidebarWidthPx(config, PRIVATE_WORKSPACE_TAB_COUNT));
  }, [config.sidebarWidth, config.sidebarWidthCustomized]);
  React.useEffect(() => {
    sidebarWidthRef.current = sidebarWidth;
  }, [sidebarWidth]);
  React.useEffect(() => {
    rightPaneWidthRef.current = rightPaneWidth;
  }, [rightPaneWidth]);

  const dayPanelDay = React.useMemo(() => {
    if (!trip || !selectedDayId) return undefined;
    return tripDays.find((x) => x.id === selectedDayId && x.tripId === trip.id);
  }, [trip, tripDays, selectedDayId]);

  const rightPaneMode = React.useMemo((): RightPaneMode => {
    if (mainWorkspaceTab === 'itinerary' && dayPanelDay) return 'itinerary-day';
    if (mainWorkspaceTab === 'journal' || mainWorkspaceTab === 'photos') return 'journal';
    if (mainWorkspaceTab === 'budget') return 'budget';
    if (mainWorkspaceTab === 'map') return 'map';
    if (mainWorkspaceTab === 'files') return 'files';
    if (mainWorkspaceTab === 'plan') {
      if (planView?.planTab === 'packing') return 'packing';
      if (planView?.planTab === 'tasks' || planView?.planTab === 'missing_costs') return 'tasks';
    }
    return 'default';
  }, [mainWorkspaceTab, dayPanelDay, planView?.planTab]);

  const journalPaneDays = React.useMemo(() => {
    if (!trip) return [];
    return tripDays.filter((d) => d.tripId === trip.id).sort((a, b) => a.dayNumber - b.dayNumber);
  }, [trip, tripDays]);

  React.useEffect(() => {
    setActivePlaceInfoId(dayPanelDay?.primaryPlaceId || '');
  }, [dayPanelDay?.id, dayPanelDay?.primaryPlaceId]);

  React.useEffect(() => {
    writeBool(LS_LEFT_COLLAPSED, leftPaneCollapsed);
  }, [leftPaneCollapsed]);

  React.useEffect(() => {
    writeBool(LS_RIGHT_COLLAPSED, rightPaneCollapsed);
  }, [rightPaneCollapsed]);

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

  const timelineRows = React.useMemo(() => {
    if (!dayPanelDay || !trip) return [];
    const cal = dayPanelDay.calendarDate ?? '';
    const rows = expandTimelineDisplayRows(dayEntries, cal, tripDays);
    return applyDayViewTimelineRowOrder(trip.id, selectedDayId ?? '', rows);
  }, [dayEntries, dayPanelDay, trip, tripDays, selectedDayId]);

  const activeEntry = React.useMemo(() => {
    if (!activeId) {
      return undefined;
    }
    const entryId = timelineRowKeyToEntryId(String(activeId));
    return localEntries.find((entry) => entry.id === entryId);
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
        moveEntryToDay(timelineRowKeyToEntryId(String(active.id)), String(over.id));
        return;
      }

      if (active.id !== over.id) {
        const oldIndex = timelineRows.findIndex((r) => r.key === String(active.id));
        const newIndex = timelineRows.findIndex((r) => r.key === String(over.id));
        if (oldIndex < 0 || newIndex < 0) {
          return;
        }
        if (!trip || !selectedDayId) {
          return;
        }
        const reorderedRows = arrayMove(timelineRows, oldIndex, newIndex);
        const reorderedEntries = entriesFromTimelineRowOrder(reorderedRows);
        const movingEntry = localEntries.find((e) => e.id === timelineRowKeyToEntryId(String(active.id)));
        if (
          movingEntry &&
          movingEntry.category === 'Accommodation' &&
          selectedDayId &&
          movingEntry.dayId !== selectedDayId
        ) {
          moveEntryToDay(movingEntry.id, selectedDayId);
          const patched = reorderedEntries.map((entry) =>
            entry.id === movingEntry.id ? { ...entry, dayId: selectedDayId } : entry
          );
          saveDayViewEntryOrder(trip.id, selectedDayId, patched.map((e) => e.id));
          const byDay = orderIdsByHomeDayFromVisualList(patched);
          for (const [dayId, ids] of Array.from(byDay.entries())) {
            reorderEntries(dayId, ids);
          }
          return;
        }
        saveDayViewTimelineRowOrder(
          trip.id,
          selectedDayId,
          reorderedRows.map((r) => r.key)
        );
        saveDayViewEntryOrder(trip.id, selectedDayId, reorderedEntries.map((e) => e.id));
        const byDay = orderIdsByHomeDayFromVisualList(reorderedEntries);
        for (const [dayId, ids] of Array.from(byDay.entries())) {
          reorderEntries(dayId, ids);
        }
      }
    },
    [dayEntries, localEntries, moveEntryToDay, reorderEntries, selectedDayId, trip, timelineRows]
  );

  const startSidebarResize = React.useCallback(
    (event: React.MouseEvent<HTMLDivElement>) => {
      event.preventDefault();
      const startX = event.clientX;
      const startWidth = sidebarWidth;

      const onMouseMove = (moveEvent: MouseEvent): void => {
        const delta = moveEvent.clientX - startX;
        const nextWidth = Math.max(LEFT_PANE_MIN_PX, Math.min(LEFT_PANE_MAX_PX, startWidth + delta));
        setSidebarWidth(nextWidth);
      };

      const onMouseUp = (): void => {
        window.removeEventListener('mousemove', onMouseMove);
        window.removeEventListener('mouseup', onMouseUp);
        isDraggingRef.current = false;
        if (saveTimerRef.current) {
          window.clearTimeout(saveTimerRef.current);
        }
        const finalWidth = Math.max(LEFT_PANE_MIN_PX, Math.min(LEFT_PANE_MAX_PX, sidebarWidthRef.current));
        saveTimerRef.current = window.setTimeout(() => {
          markSidebarWidthCustomized();
          saveConfig({ ...config, sidebarWidth: finalWidth, sidebarWidthCustomized: true }).catch(console.error);
        }, 300);
      };

      isDraggingRef.current = true;
      window.addEventListener('mousemove', onMouseMove);
      window.addEventListener('mouseup', onMouseUp);
    },
    [config, saveConfig]
  );

  const startRightPaneResize = React.useCallback((event: React.MouseEvent<HTMLDivElement>) => {
    event.preventDefault();
    const startX = event.clientX;
    const startWidth = rightPaneWidthRef.current;

    const onMouseMove = (moveEvent: MouseEvent): void => {
      const delta = startX - moveEvent.clientX;
      const nextWidth = Math.max(RIGHT_PANE_MIN_PX, Math.min(RIGHT_PANE_MAX_PX, startWidth + delta));
      setRightPaneWidth(nextWidth);
    };

    const onMouseUp = (): void => {
      window.removeEventListener('mousemove', onMouseMove);
      window.removeEventListener('mouseup', onMouseUp);
      isRightPaneDraggingRef.current = false;
      if (rightPaneSaveTimerRef.current) {
        window.clearTimeout(rightPaneSaveTimerRef.current);
      }
      rightPaneSaveTimerRef.current = window.setTimeout(() => {
        writePaneWidth(LS_RIGHT_WIDTH, rightPaneWidthRef.current);
      }, 150);
    };

    isRightPaneDraggingRef.current = true;
    window.addEventListener('mousemove', onMouseMove);
    window.addEventListener('mouseup', onMouseUp);
  }, []);

  const tripContentStyle = React.useMemo(
    () =>
      ({
        '--th-left-pane-width': `${leftPaneCollapsed ? PANE_COLLAPSED_WIDTH_PX : sidebarWidth}px`,
        '--th-right-pane-width': `${rightPaneCollapsed ? PANE_COLLAPSED_WIDTH_PX : rightPaneWidth}px`
      }) as React.CSSProperties,
    [leftPaneCollapsed, rightPaneCollapsed, rightPaneWidth, sidebarWidth]
  );

  const shell = (
    <div className={`${styles.tripContent} ${showDesktopRightPane ? '' : styles.tripContentTwoPane}`} style={tripContentStyle}>
      <div
        className={`${styles.sidebarShell} ${leftPaneCollapsed ? styles.sidebarShellCollapsed : ''}`}
        style={{ width: `${leftPaneCollapsed ? PANE_COLLAPSED_WIDTH_PX : sidebarWidth}px` }}
      >
        <PaneCollapseToggle
          side="left"
          collapsed={leftPaneCollapsed}
          onToggle={() => setLeftPaneCollapsed((value) => !value)}
          ariaLabel={leftPaneCollapsed ? 'Expand navigation panel' : 'Collapse navigation panel'}
        />
        <aside className={styles.sidebar} aria-label="Trip navigation and budget">
          <TripSidebar />
        </aside>
        {!leftPaneCollapsed ? (
          <div
            className={styles.sidebarResizeHandle}
            role="separator"
            aria-orientation="vertical"
            aria-label="Resize sidebar"
            onMouseDown={startSidebarResize}
          />
        ) : null}
      </div>
      <main className={styles.main}>
        {mainWorkspaceTab === 'itinerary' && dayPanelDay ? (
          <div className={styles.dayTitleSticky}>
            <DayTitleStrip day={dayPanelDay} />
          </div>
        ) : null}
        {mainWorkspaceTab === 'itinerary' ? (
          <DayPanel
            hideHeader
            activePlaceInfoId={activePlaceInfoId}
            onActivePlaceInfoChange={setActivePlaceInfoId}
          />
        ) : null}
        {mainWorkspaceTab === 'budget' ? <TripBudgetDetailView /> : null}
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
                style={planView?.planTab === 'tasks' ? { borderColor: 'var(--color-primary)', boxShadow: '0 0 0 1px var(--color-primary)' } : undefined}
                onClick={() => planView?.setPlanTab('tasks')}
              >
                Tasks
              </button>
              <button
                type="button"
                className={dayHeaderStyles.journalButton}
                style={planView?.planTab === 'missing_costs' ? { borderColor: 'var(--color-primary)', boxShadow: '0 0 0 1px var(--color-primary)' } : undefined}
                onClick={() => planView?.setPlanTab('missing_costs')}
              >
                Missing costs
              </button>
              <button
                type="button"
                className={dayHeaderStyles.journalButton}
                style={planView?.planTab === 'packing' ? { borderColor: 'var(--color-primary)', boxShadow: '0 0 0 1px var(--color-primary)' } : undefined}
                onClick={() => planView?.setPlanTab('packing')}
              >
                Packing
              </button>
              <button
                type="button"
                className={dayHeaderStyles.journalButton}
                style={
                  planView?.planTab === 'packing_templates'
                    ? { borderColor: 'var(--color-primary)', boxShadow: '0 0 0 1px var(--color-primary)' }
                    : undefined
                }
                onClick={() => planView?.setPlanTab('packing_templates')}
              >
                Packing templates
              </button>
            </div>
            {planView?.planTab === 'packing' ? (
              <PackingListView />
            ) : planView?.planTab === 'packing_templates' ? (
              <PackingTemplatesManager />
            ) : (
              <TripTasksView variant={planView?.planTab === 'missing_costs' ? 'missing_costs' : 'tasks'} />
            )}
          </section>
        ) : null}
      </main>
      {showDesktopRightPane ? (
        <div className={styles.rightPaneCell}>
          <RightPane
            widthPx={rightPaneWidth}
            collapsed={rightPaneCollapsed}
            onToggleCollapse={() => setRightPaneCollapsed((value) => !value)}
            onResizeStart={startRightPaneResize}
            day={dayPanelDay}
            activePlaceInfoId={activePlaceInfoId}
            showItineraryDayContent={mainWorkspaceTab === 'itinerary' && !!dayPanelDay}
            showSelectDayHint={mainWorkspaceTab === 'itinerary' && !dayPanelDay}
            showJournalMedia={mainWorkspaceTab === 'journal' || mainWorkspaceTab === 'photos'}
            journalDays={journalPaneDays}
            paneMode={rightPaneMode}
          />
        </div>
      ) : null}
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

export const TripContent: React.FC = () => (
  <PlanViewProvider>
    <TripContentInner />
  </PlanViewProvider>
);
