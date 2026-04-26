import * as React from 'react';
import { useTripWorkspace } from '../../context/TripWorkspaceContext';
import { usePlaces } from '../../context/PlacesContext';
import styles from './RouteStrip.module.css';

type Stop = {
  placeId: string;
  title: string;
  startDay: number;
  endDay: number;
  dayId: string;
};

function getTransportKind(title: string): 'flight' | 'ground' | 'arrow' {
  const t = title.toLowerCase();
  if (t.includes('flight')) return 'flight';
  if (t.includes('transport')) return 'ground';
  return 'arrow';
}

function TransportIcon({ kind }: { kind: 'flight' | 'ground' | 'arrow' }): React.ReactElement {
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
  return (
    <svg viewBox="0 0 16 16" width={12} height={12} fill="none" aria-hidden>
      <path d="M3 8h10M10 5l3 3-3 3" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

export const RouteStrip: React.FC = () => {
  const { trip, tripDays, selectedDayId, setSelectedDayId, localEntries } = useTripWorkspace();
  const { placeById } = usePlaces();

  const orderedDays = React.useMemo(() => {
    if (!trip) return [];
    return tripDays.filter((d) => d.tripId === trip.id).sort((a, b) => a.dayNumber - b.dayNumber);
  }, [trip, tripDays]);

  const stops = React.useMemo((): Stop[] => {
    const out: Stop[] = [];
    for (const day of orderedDays) {
      const place = placeById(day.primaryPlaceId);
      if (!place) continue;
      const prev = out[out.length - 1];
      if (prev && prev.placeId === place.id) {
        prev.endDay = day.dayNumber;
        continue;
      }
      out.push({
        placeId: place.id,
        title: place.title,
        startDay: day.dayNumber,
        endDay: day.dayNumber,
        dayId: day.id
      });
    }
    return out;
  }, [orderedDays, placeById]);

  if (!stops.length) return null;

  const entries = trip ? localEntries.filter((e) => e.tripId === trip.id) : [];

  return (
    <section className={styles.root} aria-label="Trip route strip">
      <div className={styles.scroll}>
        {stops.map((s, i) => {
          const next = stops[i + 1];
          const transitionEntry = next ? entries.find((e) => e.dayId === next.dayId) : undefined;
          const kind = getTransportKind(transitionEntry?.category ?? '');
          const isActive =
            selectedDayId === s.dayId ||
            orderedDays.find((d) => d.id === selectedDayId)?.dayNumber === s.startDay;
          return (
            <React.Fragment key={`${s.placeId}-${s.startDay}`}>
              <button
                type="button"
                className={`${styles.stopBtn} ${isActive ? styles.stopBtnActive : ''}`}
                onClick={() => setSelectedDayId(s.dayId)}
              >
                <span className={styles.placeName}>📍 {s.title}</span>
                <span className={styles.range}>
                  {s.startDay === s.endDay ? `Day ${s.startDay}` : `Days ${s.startDay}-${s.endDay}`}
                </span>
              </button>
              {next ? (
                <span className={styles.connector}>
                  <TransportIcon kind={kind} />
                  {Math.max(1, next.startDay - s.endDay)} day
                </span>
              ) : null}
            </React.Fragment>
          );
        })}
      </div>
    </section>
  );
};
