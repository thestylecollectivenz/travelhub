import * as React from 'react';
import type { TripDay } from '../../models/TripDay';
import type { Trip } from '../../models/Trip';
import { useTripWorkspace } from '../../context/TripWorkspaceContext';
import { useTripPermissions } from '../../hooks/useTripPermissions';
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

export interface DayItineraryToolbarProps {
  day: TripDay;
  trip: Trip;
  itineraryView: 'timeline' | 'dayPlanner';
  onItineraryViewChange: (view: 'timeline' | 'dayPlanner') => void;
  onJournalEntry: () => void;
  onTipToggle: () => void;
}

export const DayItineraryToolbar: React.FC<DayItineraryToolbarProps> = ({
  day,
  trip,
  itineraryView,
  onItineraryViewChange,
  onJournalEntry,
  onTipToggle
}) => {
  const { setEditingCardId } = useTripWorkspace();
  const { canEditItinerary, canUseExports } = useTripPermissions();

  return (
    <div className={styles.itineraryToolbar} role="group" aria-label="Itinerary view and actions">
      <button
        type="button"
        className={styles.itineraryViewBtn}
        aria-pressed={itineraryView === 'timeline'}
        onClick={() => onItineraryViewChange('timeline')}
      >
        <TimelineGlyph />
        Timeline
      </button>
      <button
        type="button"
        className={styles.itineraryViewBtn}
        aria-pressed={itineraryView === 'dayPlanner'}
        onClick={() => onItineraryViewChange('dayPlanner')}
      >
        <PlannerGlyph />
        Day Planner
      </button>
      {canEditItinerary ? (
        <button type="button" className={styles.itineraryViewBtn} onClick={() => window.dispatchEvent(new Event('open-cruise-import'))}>
          Import cruise itinerary
        </button>
      ) : null}
      {canUseExports ? (
        <button type="button" className={styles.itineraryViewBtn} onClick={() => window.dispatchEvent(new Event('export-trip-excel'))}>
          Export to Excel
        </button>
      ) : null}
      {canEditItinerary ? (
        <>
          <span className={styles.toolbarDivider} aria-hidden />
          <button type="button" className={styles.itineraryViewBtn} onClick={onTipToggle}>
            Tip calc
          </button>
          <button type="button" className={styles.itineraryViewBtn} onClick={onJournalEntry}>
            Journal entry
          </button>
          <button
            type="button"
            className={styles.addButton}
            onClick={() => {
              if (itineraryView !== 'timeline') {
                onItineraryViewChange('timeline');
              }
              setEditingCardId('new');
            }}
          >
            + Add
          </button>
        </>
      ) : null}
    </div>
  );
};
