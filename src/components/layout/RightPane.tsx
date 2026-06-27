import * as React from 'react';
import type { TripDay } from '../../models/TripDay';
import { useTripWorkspace } from '../../context/TripWorkspaceContext';
import { useConfig } from '../../context/ConfigContext';
import { BudgetBreakdownTile } from '../day/BudgetBreakdownTile';
import { DayPlaceInfoSection } from '../day/DayPlaceInfoSection';
import { PaneCollapseToggle } from './PaneCollapseToggle';
import { RightPaneTripSummary } from './RightPaneTripSummary';
import { RightPaneJournalMedia } from './RightPaneJournalMedia';
import { RightPaneMapAnalysis } from './RightPaneMapAnalysis';
import { RightPaneBudgetInsights } from './RightPaneBudgetInsights';
import { RightPaneFilesInsights } from './RightPaneFilesInsights';
import { RightPaneTasksInsights } from './RightPaneTasksInsights';
import { RightPanePackingTemplates } from './RightPanePackingTemplates';
import { RightPaneShoppingSummary } from './RightPaneShoppingSummary';
import { RoleGate } from '../shared/RoleGate';
import styles from './RightPane.module.css';

export type RightPaneMode =
  | 'itinerary-day'
  | 'journal'
  | 'budget'
  | 'map'
  | 'files'
  | 'tasks'
  | 'packing'
  | 'shopping'
  | 'default';

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
  paneMode?: RightPaneMode;
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
  journalDays = [],
  paneMode = 'default'
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
              <RoleGate requiredRole="Editor">
                <BudgetBreakdownTile
                  tripId={trip.id}
                  dayId={day.id}
                  defaultExpanded={config.dayBreakdownVisibleByDefault}
                />
              </RoleGate>
            </div>
          </>
        ) : paneMode === 'journal' && showJournalMedia && journalDays.length ? (
          <RightPaneJournalMedia journalDays={journalDays} />
        ) : paneMode === 'map' ? (
          <RightPaneMapAnalysis />
        ) : paneMode === 'budget' ? (
          <RoleGate requiredRole="Editor">
            <RightPaneBudgetInsights />
          </RoleGate>
        ) : paneMode === 'files' ? (
          <RightPaneFilesInsights />
        ) : paneMode === 'tasks' ? (
          <RightPaneTasksInsights />
        ) : paneMode === 'packing' ? (
          <RightPanePackingTemplates />
        ) : paneMode === 'shopping' ? (
          <RoleGate requiredRole="Editor">
            <RightPaneShoppingSummary />
          </RoleGate>
        ) : (
          <RightPaneTripSummary showSelectDayHint={showSelectDayHint} />
        )}
      </div>
    </div>
  );
};
