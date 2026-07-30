import * as React from 'react';
import { useConfig } from '../../context/ConfigContext';
import { usePlaces } from '../../context/PlacesContext';
import { useSpContext } from '../../context/SpContext';
import { useTripWorkspace } from '../../context/TripWorkspaceContext';
import {
  LOCATION_INFO_TRIP_OPEN_BACKFILL_DELAY_MS,
  runLocationInfoTripOpenBackfill
} from '../../utils/locationInfoTripOpenBackfill';

/** Runs location-info card sync + AI backfill once in the background after trip + places load. */
export const LocationInfoTripOpenBackfill: React.FC = () => {
  const spContext = useSpContext();
  const { config } = useConfig();
  const { placeById, loading: placesLoading } = usePlaces();
  const { trip, tripDays, localEntries, loading, error } = useTripWorkspace();
  const ranForTripRef = React.useRef<string>('');
  const tripDaysRef = React.useRef(tripDays);
  const entriesRef = React.useRef(localEntries);
  const placeByIdRef = React.useRef(placeById);

  React.useEffect(() => {
    tripDaysRef.current = tripDays;
  }, [tripDays]);

  React.useEffect(() => {
    entriesRef.current = localEntries;
  }, [localEntries]);

  React.useEffect(() => {
    placeByIdRef.current = placeById;
  }, [placeById]);

  React.useEffect(() => {
    if (!trip?.id) {
      ranForTripRef.current = '';
      return;
    }
    // Wait for trip + places so placeById resolves; do not re-arm on entry/place identity churn.
    if (loading || error || placesLoading) return;
    if (!(config.geminiApiKey || '').trim()) return;
    if (ranForTripRef.current === trip.id) return;

    const tripId = trip.id;
    const timer = window.setTimeout(() => {
      if (ranForTripRef.current === tripId) return;
      ranForTripRef.current = tripId;
      void runLocationInfoTripOpenBackfill({
        spContext,
        tripId,
        tripDays: tripDaysRef.current,
        entries: entriesRef.current,
        placeById: placeByIdRef.current,
        geminiApiKey: config.geminiApiKey
      }).catch((err) => {
        // eslint-disable-next-line no-console
        console.error('LocationInfoTripOpenBackfill', err);
      });
    }, LOCATION_INFO_TRIP_OPEN_BACKFILL_DELAY_MS);

    return () => window.clearTimeout(timer);
  }, [loading, error, placesLoading, trip?.id, spContext, config.geminiApiKey]);

  return null;
};
