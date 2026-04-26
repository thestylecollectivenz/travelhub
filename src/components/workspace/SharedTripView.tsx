import * as React from 'react';
import { TripSidebar } from '../sidebar/TripSidebar';
import { SharedDayPanel } from '../day/SharedDayPanel';
import { TripJournalFeed } from '../journal/TripJournalFeed';
import { TripPhotoAlbum } from '../journal/TripPhotoAlbum';
import { useTripWorkspace } from '../../context/TripWorkspaceContext';
import { useConfig } from '../../context/ConfigContext';
import styles from './TripWorkspace.module.css';

export const SharedTripView: React.FC = () => {
  const { mainWorkspaceTab } = useTripWorkspace();
  const { config, saveConfig } = useConfig();
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

  return (
    <div className={styles.tripContent}>
      <div className={styles.sidebarShell} style={{ width: `${sidebarWidth}px` }}>
        <aside className={styles.sidebar} aria-label="Trip days">
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
        {mainWorkspaceTab === 'itinerary' || mainWorkspaceTab === 'documents' || mainWorkspaceTab === 'links' || mainWorkspaceTab === 'map' ? <SharedDayPanel /> : null}
        {mainWorkspaceTab === 'journal' ? <TripJournalFeed /> : null}
        {mainWorkspaceTab === 'photos' ? <TripPhotoAlbum /> : null}
      </main>
    </div>
  );
};
