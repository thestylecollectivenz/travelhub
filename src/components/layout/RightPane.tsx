import * as React from 'react';
import type { TripDay } from '../../models/TripDay';
import { useTripWorkspace } from '../../context/TripWorkspaceContext';
import { useConfig } from '../../context/ConfigContext';
import { BudgetBreakdownTile } from '../day/BudgetBreakdownTile';
import { DayPlaceInfoSection } from '../day/DayPlaceInfoSection';
import { PaneCollapseToggle } from './PaneCollapseToggle';
import { RightPaneTripSummary } from './RightPaneTripSummary';
import { RightPaneJournalMedia } from './RightPaneJournalMedia';
import styles from './RightPane.module.css';

export interface RightPaneProps {
  widthPx: number;
  collapsed: boolean;
  onToggleCollapse: () => void;
  onResizeStart: (event: React.MouseEvent<HTMLDivElement>) => void;
  day?: TripDay;
  activePlaceInfoId: string;
  showItineraryDayContent: boolean;
  showSelectDayHint: boolean;
  showJournalMedia?: boolean;
  journalDays?: TripDay[];
}

export const RightPane: React.FC<RightPaneProps> = ({
  widthPx,
  collapsed,
  onToggleCollapse,
  onResizeStart,
  day,
  activePlaceInfoId,
  showItineraryDayContent,
  showSelectDayHint,
  showJournalMedia = false,
  journalDays = []
}) => {
  const { trip } = useTripWorkspace();
  const { config } = useConfig();

  return (
    <div
      className={`${styles.shell} ${collapsed ? styles.collapsed : ''}`}
      style={{ width: collapsed ? undefined : `${widthPx}px` }}
      aria-label="Trip details"
    >
      <div
        className={styles.resizeHandle}
        role="separator"
        aria-orientation="vertical"
        aria-label="Resize details panel"
        onMouseDown={onResizeStart}
      />
      <PaneCollapseToggle
        side="right"
        collapsed={collapsed}
        onToggle={onToggleCollapse}
        ariaLabel={collapsed ? 'Expand details panel' : 'Collapse details panel'}
      />
      <div className={styles.scroll}>
        {showItineraryDayContent && day && trip ? (
          <>
            <DayPlaceInfoSection day={day} activePlaceInfoId={activePlaceInfoId} />
            <hr className={styles.divider} />
            <div id="day-breakdown-tile">
              <BudgetBreakdownTile
                tripId={trip.id}
                dayId={day.id}
                defaultExpanded={config.dayBreakdownVisibleByDefault}
              />
            </div>
          </>
        ) : showJournalMedia && journalDays.length ? (
          <>
            <RightPaneTripSummary showSelectDayHint={false} />
            <hr className={styles.divider} />
            <RightPaneJournalMedia journalDays={journalDays} />
          </>
        ) : (
          <RightPaneTripSummary showSelectDayHint={showSelectDayHint} />
        )}
      </div>
    </div>
  );
};
