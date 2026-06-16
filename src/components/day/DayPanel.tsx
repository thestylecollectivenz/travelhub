import * as React from 'react';
import { useTripWorkspace } from '../../context/TripWorkspaceContext';
import { useConfig } from '../../context/ConfigContext';
import { ItineraryTimeline } from '../itinerary/ItineraryTimeline';
import { ItineraryDayPlannerView } from '../itinerary/ItineraryDayPlannerView';
import { JournalFeed } from '../journal/JournalFeed';
import { CruiseItineraryImport } from '../cruise/CruiseItineraryImport';
import { TipCalculator } from '../utilities/TipCalculator';
import { COUNTRY_DATA } from '../../data/countryData';
import { usePlaces } from '../../context/PlacesContext';
import { DayHeader } from './DayHeader';
import { DayItineraryToolbar } from './DayItineraryToolbar';
import styles from './DayPanel.module.css';

export interface DayPanelProps {
  /** When true, day title is rendered by TripContent sticky rail. */
  hideHeader?: boolean;
  activePlaceInfoId?: string;
  onActivePlaceInfoChange?: (placeId: string) => void;
}

export const DayPanel: React.FC<DayPanelProps> = ({
  hideHeader = false,
  activePlaceInfoId,
  onActivePlaceInfoChange
}) => {
  const { trip, tripDays, selectedDayId } = useTripWorkspace();
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
      {hideHeader ? (
        <DayHeader
          day={day}
          stickyTitleOnly
          activePlaceInfoId={activePlaceInfoId}
          onActivePlaceInfoChange={onActivePlaceInfoChange}
        />
      ) : (
        <DayHeader
          day={day}
          activePlaceInfoId={activePlaceInfoId}
          onActivePlaceInfoChange={onActivePlaceInfoChange}
        />
      )}
      <div className={styles.dayToolbarSticky}>
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
