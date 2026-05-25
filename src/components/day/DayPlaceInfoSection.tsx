import * as React from 'react';
import type { TripDay } from '../../models/TripDay';
import { useTripWorkspace } from '../../context/TripWorkspaceContext';
import { usePlaces } from '../../context/PlacesContext';
import { PlaceInfoPanel } from './PlaceInfoPanel';
import { datesWherePlaceAppears, forecastDatesForPlaceStay } from '../../utils/placeForecastDates';
import { parseAdditionalPlaceRefs } from '../../utils/tripDayPlaces';
import styles from './DayHeader.module.css';

export interface DayPlaceInfoSectionProps {
  day: TripDay;
  activePlaceInfoId: string;
}

export const DayPlaceInfoSection: React.FC<DayPlaceInfoSectionProps> = ({ day, activePlaceInfoId }) => {
  const { trip, tripDays } = useTripWorkspace();
  const { placeById } = usePlaces();

  const additionalRefs = React.useMemo(() => parseAdditionalPlaceRefs(day.additionalPlaceIds), [day.additionalPlaceIds]);

  const dayLocations = React.useMemo(() => {
    const primary = day.primaryPlaceId ? placeById(day.primaryPlaceId) : undefined;
    const additional = additionalRefs
      .map((ref) => {
        const p = placeById(ref.placeId);
        if (!p) return undefined;
        return { placeId: ref.placeId, place: p, returnToPrimary: ref.returnToPrimary };
      })
      .filter(Boolean) as Array<{ placeId: string; place: NonNullable<ReturnType<typeof placeById>>; returnToPrimary: boolean }>;
    return { primary, additional };
  }, [day.primaryPlaceId, additionalRefs, placeById]);

  const allPlacesForInfo = React.useMemo(() => {
    const rows: Array<{ id: string; place: NonNullable<typeof dayLocations.primary> }> = [];
    if (dayLocations.primary) {
      rows.push({ id: dayLocations.primary.id, place: dayLocations.primary });
    }
    for (const a of dayLocations.additional) {
      rows.push({ id: a.place.id, place: a.place });
    }
    return rows;
  }, [dayLocations]);

  const activePlaceInfo =
    allPlacesForInfo.find((p) => p.id === activePlaceInfoId) ?? allPlacesForInfo[0];

  const weatherAnchorDate =
    day.dayType === 'PreTrip' && trip?.dateStart ? trip.dateStart.split('T')[0] : day.calendarDate;

  const activeForecastDates = React.useMemo(() => {
    if (!activePlaceInfo?.place?.id) return [weatherAnchorDate?.slice(0, 10) || ''].filter(Boolean);
    const stayDates = datesWherePlaceAppears(tripDays, activePlaceInfo.place.id);
    return forecastDatesForPlaceStay(stayDates);
  }, [activePlaceInfo?.place?.id, tripDays, weatherAnchorDate]);

  return (
    <div className={styles.placeInfoCard}>
      {allPlacesForInfo.length > 0 && activePlaceInfo ? (
        <PlaceInfoPanel
          place={activePlaceInfo.place}
          weatherAnchorDate={weatherAnchorDate}
          forecastDates={activeForecastDates}
          showHeader
        />
      ) : (
        <div className={styles.infoSub}>Set a primary location to view place intelligence.</div>
      )}
    </div>
  );
};
