import * as React from 'react';
import { useTripWorkspace } from '../../context/TripWorkspaceContext';
import { usePlanView } from '../../context/PlanViewContext';
import { useConfig } from '../../context/ConfigContext';
import { ItineraryTimeline } from '../itinerary/ItineraryTimeline';
import { ItineraryDayPlannerView } from '../itinerary/ItineraryDayPlannerView';
import { JournalFeed } from '../journal/JournalFeed';
import { CruiseItineraryImport } from '../cruise/CruiseItineraryImport';
import { TipCalculator } from '../utilities/TipCalculator';
import { COUNTRY_DATA } from '../../data/countryData';
import { usePlaces } from '../../context/PlacesContext';
import { BudgetBreakdownTile } from './BudgetBreakdownTile';
import { DayHeader } from './DayHeader';
import styles from './DayPanel.module.css';

function TimelineGlyph(): React.ReactElement {
  return (
    <svg width={14} height={14} viewBox="0 0 16 16" fill="none" aria-hidden>
      <path d="M2 3.5h12M2 8h8M2 12.5h10" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" />
      <circle cx="12" cy="8" r="1.6" fill="currentColor" />
    </svg>
  );
}

function PlannerGlyph(): React.ReactElement {
  return (
    <svg width={14} height={14} viewBox="0 0 16 16" fill="none" aria-hidden>
      <rect x="2.5" y="2.5" width="11" height="11" rx="1.5" stroke="currentColor" strokeWidth="1.2" />
      <path d="M6 2.5v11M10 2.5v11M2.5 6h11M2.5 10h11" stroke="currentColor" strokeWidth="1" />
    </svg>
  );
}

export const DayPanel: React.FC = () => {
  const {
    trip,
    tripDays,
    selectedDayId,
    setEditingCardId,
    workspaceReturn,
    setWorkspaceReturn,
    setMainWorkspaceTab
  } = useTripWorkspace();
  const planView = usePlanView();
  const { config } = useConfig();
  const { placeById } = usePlaces();
  const [openJournalSignal, setOpenJournalSignal] = React.useState(0);
  const [itineraryView, setItineraryView] = React.useState<'timeline' | 'dayPlanner'>('timeline');
  const [tipOpen, setTipOpen] = React.useState(false);

  const day = React.useMemo(() => {
    if (!trip) return undefined;
    return tripDays.find((d) => d.tripId === trip.id && d.id === selectedDayId);
  }, [trip, tripDays, selectedDayId]);

  if (!day || !trip) {
    return (
      <div className={styles.emptyState} role="status">
        Select a day to get started
      </div>
    );
  }

  const tipPlace = day.primaryPlaceId ? placeById(day.primaryPlaceId) : undefined;
  const tipCountryData = tipPlace ? COUNTRY_DATA[tipPlace.countryCode] : undefined;

  return (
    <div className={styles.root}>
      {workspaceReturn ? (
        <div className={styles.returnBar} role="navigation">
          <button
            type="button"
            className={styles.returnBtn}
            onClick={() => {
              setMainWorkspaceTab(workspaceReturn.tab);
              if (workspaceReturn.planMode && planView) {
                planView.setPlanTab(workspaceReturn.planMode);
              }
              if (workspaceReturn.tasksViewMode && planView) {
                planView.setTasksViewMode(workspaceReturn.tasksViewMode);
              }
              setWorkspaceReturn(null);
            }}
          >
            ← Back to {workspaceReturn.label}
          </button>
        </div>
      ) : null}
      <DayHeader day={day} />
      <div id="day-breakdown-tile">
        <BudgetBreakdownTile
          tripId={trip.id}
          dayId={day.id}
          defaultExpanded={config.dayBreakdownVisibleByDefault}
        />
      </div>
      <div className={styles.itineraryToolbar} role="group" aria-label="Itinerary view and actions">
        <button
          type="button"
          className={styles.itineraryViewBtn}
          aria-pressed={itineraryView === 'timeline'}
          onClick={() => setItineraryView('timeline')}
        >
          <TimelineGlyph />
          Timeline
        </button>
        <button
          type="button"
          className={styles.itineraryViewBtn}
          aria-pressed={itineraryView === 'dayPlanner'}
          onClick={() => setItineraryView('dayPlanner')}
        >
          <PlannerGlyph />
          Day Planner
        </button>
        <button
          type="button"
          className={styles.itineraryViewBtn}
          onClick={() => window.dispatchEvent(new Event('open-cruise-import'))}
        >
          Import cruise itinerary
        </button>
        <button
          type="button"
          className={styles.itineraryViewBtn}
          onClick={() => window.dispatchEvent(new Event('export-trip-excel'))}
        >
          Export to Excel
        </button>
        <span className={styles.toolbarDivider} aria-hidden />
        <button type="button" className={styles.itineraryViewBtn} onClick={() => setTipOpen((v) => !v)}>
          Tip calc
        </button>
        <button type="button" className={styles.itineraryViewBtn} onClick={() => setOpenJournalSignal((n) => n + 1)}>
          Journal entry
        </button>
        <button type="button" className={styles.addButton} onClick={() => setEditingCardId('new')}>
          + Add
        </button>
      </div>
      {tipOpen ? (
        <TipCalculator
          currency={tipCountryData?.currencyCode || config.homeCurrency}
          defaultPercent={(() => {
            const t = (tipCountryData?.tipping || '').toLowerCase();
            if (t.indexOf('not expected') >= 0 || t.indexOf('not customary') >= 0) return 0;
            const m = (tipCountryData?.tipping || '').match(/(\d{1,2})\s?%/);
            return m ? Number(m[1]) : 10;
          })()}
          note={tipCountryData?.tipping || 'No tipping guidance available for this location.'}
          onClose={() => setTipOpen(false)}
        />
      ) : null}
      <CruiseItineraryImport trip={trip} />
      {itineraryView === 'timeline' ? <ItineraryTimeline dayId={day.id} /> : <ItineraryDayPlannerView />}
      <div className={styles.hideOnPrint}>
        <JournalFeed dayId={day.id} openComposerSignal={openJournalSignal} />
      </div>
    </div>
  );
};
