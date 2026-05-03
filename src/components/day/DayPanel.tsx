import * as React from 'react';
import { useTripWorkspace } from '../../context/TripWorkspaceContext';
import { ItineraryTimeline } from '../itinerary/ItineraryTimeline';
import { ItineraryDayPlannerView } from '../itinerary/ItineraryDayPlannerView';
import { JournalFeed } from '../journal/JournalFeed';
import { CruiseItineraryImport } from '../cruise/CruiseItineraryImport';
import { sumForDay } from '../../utils/financialUtils';
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
  const { trip, tripDays, selectedDayId, setEditingCardId, localEntries, convertToHomeCurrency } = useTripWorkspace();
  const [openJournalSignal, setOpenJournalSignal] = React.useState(0);
  const [itineraryView, setItineraryView] = React.useState<'timeline' | 'dayPlanner'>('timeline');

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

  const entries = React.useMemo(() => localEntries.filter((e) => e.tripId === trip.id), [localEntries, trip.id]);

  const dayTotal = sumForDay(entries, day.id, convertToHomeCurrency, day.calendarDate);

  return (
    <div className={styles.root}>
      <DayHeader
        day={day}
        dayTotal={dayTotal}
        onAddEntry={() => setEditingCardId('new')}
        onWriteJournal={() => setOpenJournalSignal((n) => n + 1)}
      />
      <BudgetBreakdownTile tripId={trip.id} dayId={day.id} />
      <div className={styles.itineraryToolbar} role="group" aria-label="Itinerary view">
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
      </div>
      <CruiseItineraryImport trip={trip} />
      {itineraryView === 'timeline' ? <ItineraryTimeline dayId={day.id} /> : <ItineraryDayPlannerView />}
      <div className={styles.hideOnPrint}>
        <JournalFeed dayId={day.id} openComposerSignal={openJournalSignal} />
      </div>
    </div>
  );
};
