import * as React from 'react';
import { useTripWorkspace } from '../../context/TripWorkspaceContext';
import { usePlaces } from '../../context/PlacesContext';
import { parseAdditionalPlaceRefs } from '../../utils/tripDayPlaces';
import { requestSidebarDayFocus } from '../../utils/sidebarDayFocus';
import { compactPlaceLabel } from '../../utils/placeDisplayLabel';
import { formatRouteStripDayLabel } from '../../utils/formatTripDayDate';
import styles from './RouteStrip.module.css';

type SecondaryPlace = {
  label: string;
  returnToPrimary: boolean;
};

type Stop = {
  placeId: string;
  title: string;
  startDay: number;
  dayId: string;
  additionalPlaces: SecondaryPlace[];
  calendarDate: string;
};

function TransportIcon({ kind }: { kind: 'flight' | 'ground' | 'cruise' | 'arrow' }): React.ReactElement {
  if (kind === 'flight') {
    return (
      <svg viewBox="0 0 16 16" width={12} height={12} fill="none" aria-hidden>
        <path d="M2 9.5 14 6.8l-1.2-1.1-4.3.8L6.3 3.2 5 3.5l1.2 3-2.6.5-1.2-.8L2 7.6l1.5 1.9-1 .2L2 9.5Z" fill="currentColor" />
      </svg>
    );
  }
  if (kind === 'ground') {
    return (
      <svg viewBox="0 0 16 16" width={12} height={12} fill="none" aria-hidden>
        <rect x="2" y="4" width="12" height="7" rx="1.4" stroke="currentColor" strokeWidth="1.2" />
        <circle cx="5" cy="12" r="1" fill="currentColor" />
        <circle cx="11" cy="12" r="1" fill="currentColor" />
      </svg>
    );
  }
  if (kind === 'cruise') {
    return (
      <svg viewBox="0 0 16 16" width={12} height={12} fill="none" aria-hidden>
        <path d="M2.5 10.5h11l-1.2 2H3.7l-1.2-2Z" fill="currentColor" />
        <path d="M5 10.5V6h6v4.5M7 6V4h2v2" stroke="currentColor" strokeWidth="1.1" />
      </svg>
    );
  }
  return (
    <svg viewBox="0 0 16 16" width={12} height={12} fill="none" aria-hidden>
      <path d="M3 8h10M10 5l3 3-3 3" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

type IconKind = 'flight' | 'ground' | 'cruise' | 'arrow';

export const RouteStrip: React.FC = () => {
  const { trip, tripDays, selectedDayId, setSelectedDayId, setMainWorkspaceTab, localEntries } = useTripWorkspace();
  const { placeById } = usePlaces();
  const scrollRef = React.useRef<HTMLDivElement>(null);

  React.useEffect(() => {
    if (!selectedDayId || !scrollRef.current) return;
    const el = scrollRef.current.querySelector(`[data-day-id="${selectedDayId}"]`);
    if (el instanceof HTMLElement) {
      el.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'center' });
    }
  }, [selectedDayId]);

  const orderedDays = React.useMemo(() => {
    if (!trip) return [];
    return tripDays.filter((d) => d.tripId === trip.id).sort((a, b) => a.dayNumber - b.dayNumber);
  }, [trip, tripDays]);

  const stops = React.useMemo((): Stop[] => {
    const out: Stop[] = [];
    for (const day of orderedDays) {
      const place = placeById(day.primaryPlaceId);
      if (!place) continue;
      const refs = parseAdditionalPlaceRefs(day.additionalPlaceIds);
      out.push({
        placeId: place.id,
        title: place.title,
        startDay: day.dayNumber,
        dayId: day.id,
        calendarDate: day.calendarDate,
        additionalPlaces: refs
          .map((r) => {
            const title = placeById(r.placeId)?.title;
            if (!title) return undefined;
            return { label: title, returnToPrimary: r.returnToPrimary };
          })
          .filter(Boolean) as SecondaryPlace[]
      });
    }
    return out;
  }, [orderedDays, placeById]);

  const entries = React.useMemo(
    () => (trip ? localEntries.filter((e) => e.tripId === trip.id) : []),
    [trip, localEntries]
  );

  const iconsForLeg = React.useCallback(
    (leaving: Stop, arriving?: Stop): IconKind[] => {
      if (!arriving) return [];
      const dayEntries = entries.filter((e) => e.dayId === leaving.dayId);
      const out: IconKind[] = [];
      const hasFlight = dayEntries.some((e) => (e.category || '').toLowerCase() === 'flights');
      const hasGround = dayEntries.some((e) => (e.category || '').toLowerCase() === 'transport');
      const hasCruiseActive = entries.some((e) => {
        if ((e.category || '').toLowerCase() !== 'cruise' || !e.embarksDate || !e.disembarksDate) return false;
        return leaving.calendarDate >= e.embarksDate && leaving.calendarDate <= e.disembarksDate;
      });
      const nextDayGap = arriving.startDay >= leaving.startDay + 1;
      if (hasFlight && nextDayGap) out.push('flight');
      if (hasGround && nextDayGap) out.push('ground');
      if (hasCruiseActive) out.push('cruise');
      return out.length ? out : ['arrow'];
    },
    [entries]
  );

  if (!stops.length) return null;

  return (
    <section className={styles.root} aria-label="Trip route strip">
      <div className={styles.scroll} ref={scrollRef}>
        {stops.map((s, i) => {
          const next = stops[i + 1];
          const kinds = iconsForLeg(s, next);
          const isActive =
            selectedDayId === s.dayId ||
            orderedDays.find((d) => d.id === selectedDayId)?.dayNumber === s.startDay;
          return (
            <React.Fragment key={`${s.placeId}-${s.startDay}`}>
              <div className={styles.stopCell}>
                <button
                  type="button"
                  className={styles.locationsEditBtn}
                  title="Edit day locations"
                  aria-label={`Edit locations for day ${s.startDay}`}
                  onClick={() => {
                    setMainWorkspaceTab('itinerary');
                    setSelectedDayId(s.dayId);
                    requestSidebarDayFocus(s.dayId);
                    window.dispatchEvent(
                      new CustomEvent('travelhub-expand-day-locations', { detail: { dayId: s.dayId } })
                    );
                  }}
                >
                  ✎
                </button>
                <button
                  type="button"
                  data-day-id={s.dayId}
                  className={`${styles.stopBtn} ${isActive ? styles.stopBtnActive : ''}`}
                  onClick={() => {
                    setMainWorkspaceTab('itinerary');
                    setSelectedDayId(s.dayId);
                    requestSidebarDayFocus(s.dayId);
                  }}
                >
                  <div className={styles.stopBtnBody}>
                    <span className={styles.placeName}>📍 {compactPlaceLabel(s.title)}</span>
                    {s.additionalPlaces.length ? (
                      <span className={styles.secondaryPlaces}>
                        {s.additionalPlaces.map((place, idx) => (
                          <span
                            key={`${place.label}-${idx}`}
                            className={styles.secondaryLine}
                            title={place.returnToPrimary ? 'Return to primary' : 'One way'}
                          >
                            <span className={styles.secondaryArrow} aria-hidden>
                              {place.returnToPrimary ? '↩' : '→'}
                            </span>
                            {compactPlaceLabel(place.label)}
                          </span>
                        ))}
                      </span>
                    ) : null}
                  </div>
                  <span className={styles.range}>{formatRouteStripDayLabel(s.startDay, s.calendarDate)}</span>
                </button>
              </div>
              {next ? (
                <span className={styles.connector}>
                  {kinds.map((kind, idx) => <TransportIcon key={`${kind}-${idx}`} kind={kind} />)}
                </span>
              ) : null}
            </React.Fragment>
          );
        })}
      </div>
    </section>
  );
};
