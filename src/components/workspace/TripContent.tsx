import * as React from 'react';
import { DndContext, DragOverlay, type DragEndEvent, type DragStartEvent, closestCenter } from '@dnd-kit/core';
import { arrayMove } from '@dnd-kit/sortable';
import { DayPanel } from '../day/DayPanel';
import { TripJournalFeed } from '../journal/TripJournalFeed';
import { TripPhotoAlbum } from '../journal/TripPhotoAlbum';
import { TripDocumentsView } from '../documents/TripDocumentsView';
import { TripLinksView } from '../documents/TripLinksView';
import { TripSidebar } from '../sidebar/TripSidebar';
import { useTripWorkspace } from '../../context/TripWorkspaceContext';
import styles from './TripWorkspace.module.css';

export const TripContent: React.FC = () => {
  const { selectedDayId, localEntries, reorderEntries, moveEntryToDay, mainWorkspaceTab } = useTripWorkspace();
  const [activeId, setActiveId] = React.useState<string | null>(null);
  const [sidebarWidth, setSidebarWidth] = React.useState<number>(320);

  const dayEntries = React.useMemo(() => {
    return [...localEntries]
      .filter((entry) => entry.dayId === selectedDayId)
      .sort((a, b) => a.sortOrder - b.sortOrder);
  }, [localEntries, selectedDayId]);

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
        const reordered = arrayMove(dayEntries, oldIndex, newIndex);
        reorderEntries(selectedDayId, reordered.map((e) => e.id));
      }
    },
    [dayEntries, moveEntryToDay, reorderEntries, selectedDayId]
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
      };

      window.addEventListener('mousemove', onMouseMove);
      window.addEventListener('mouseup', onMouseUp);
    },
    [sidebarWidth]
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
      <main className={styles.main}>
        {mainWorkspaceTab === 'itinerary' ? <DayPanel /> : null}
        {mainWorkspaceTab === 'journal' ? <TripJournalFeed /> : null}
        {mainWorkspaceTab === 'photos' ? <TripPhotoAlbum /> : null}
        {mainWorkspaceTab === 'documents' ? <TripDocumentsView /> : null}
        {mainWorkspaceTab === 'links' ? <TripLinksView /> : null}
      </main>
    </div>
  );

  if (mainWorkspaceTab !== 'itinerary') {
    return shell;
  }

  return (
    <DndContext collisionDetection={closestCenter} onDragStart={handleDragStart} onDragEnd={handleDragEnd}>
      {shell}
      <DragOverlay>
        {activeEntry ? (
          <div className={styles.dragOverlayCard}>
            <div className={styles.dragOverlayTitle}>{activeEntry.title || 'Untitled'}</div>
          </div>
        ) : null}
      </DragOverlay>
    </DndContext>
  );
};
