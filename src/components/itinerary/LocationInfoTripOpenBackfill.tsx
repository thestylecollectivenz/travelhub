import * as React from 'react';
import { useConfig } from '../../context/ConfigContext';
import { usePlaces } from '../../context/PlacesContext';
import { useSpContext } from '../../context/SpContext';
import { useTripWorkspace } from '../../context/TripWorkspaceContext';
import {
  LOCATION_INFO_TRIP_OPEN_BACKFILL_DELAY_MS,
  runLocationInfoTripOpenBackfill
} from '../../utils/locationInfoTripOpenBackfill';

/** Runs location-info card sync + AI backfill in the background after trip data loads. */
export const LocationInfoTripOpenBackfill: React.FC = () => {
  const spContext = useSpContext();
  const { config } = useConfig();
  const { placeById } = usePlaces();
  const { trip, tripDays, localEntries, loading, error } = useTripWorkspace();
  const ranForTripRef = React.useRef<string>('');

  React.useEffect(() => {
    if (loading || error || !trip?.id) return;
    if (!(config.geminiApiKey || '').trim()) return;
    if (ranForTripRef.current === trip.id) return;

    const tripId = trip.id;
    const timer = window.setTimeout(() => {
      ranForTripRef.current = tripId;
      void runLocationInfoTripOpenBackfill({
        spContext,
        tripId,
        tripDays,
        entries: localEntries,
        placeById,
        geminiApiKey: config.geminiApiKey
      }).catch((err) => {
        // eslint-disable-next-line no-console
        console.error('LocationInfoTripOpenBackfill', err);
      });
    }, LOCATION_INFO_TRIP_OPEN_BACKFILL_DELAY_MS);

    return () => window.clearTimeout(timer);
  }, [loading, error, trip?.id, tripDays, localEntries, spContext, placeById, config.geminiApiKey]);

  React.useEffect(() => {
    if (!trip?.id) {
      ranForTripRef.current = '';
    }
  }, [trip?.id]);

  return null;
};
