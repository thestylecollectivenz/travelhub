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
import { DayItineraryToolbar } from './DayItineraryToolbar';
import styles from './DayPanel.module.css';

export interface DayPanelProps {
  /** When true, day title is rendered by TripContent sticky rail. */
  hideHeader?: boolean;
}

export const DayPanel: React.FC<DayPanelProps> = ({ hideHeader = false }) => {
  const { trip, tripDays, selectedDayId, setEditingCardId } = useTripWorkspace();
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
      {hideHeader ? <DayHeader day={day} stickyTitleOnly /> : <DayHeader day={day} />}
      <div id="day-breakdown-tile">
        <BudgetBreakdownTile
          tripId={trip.id}
          dayId={day.id}
          defaultExpanded={config.dayBreakdownVisibleByDefault}
        />
      </div>
      <div className={hideHeader ? styles.dayToolbarSticky : undefined}>
        <DayItineraryToolbar
          day={day}
          trip={trip}
          itineraryView={itineraryView}
          onItineraryViewChange={setItineraryView}
          onJournalEntry={() => setOpenJournalSignal((n) => n + 1)}
          onTipToggle={() => setTipOpen((v) => !v)}
        />
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
      <div className={hideHeader ? styles.dayContentBelowToolbar : undefined}>
        {itineraryView === 'timeline' ? <ItineraryTimeline dayId={day.id} /> : <ItineraryDayPlannerView />}
      </div>
      <div className={styles.hideOnPrint}>
        <JournalFeed dayId={day.id} openComposerSignal={openJournalSignal} />
      </div>
    </div>
  );
};
