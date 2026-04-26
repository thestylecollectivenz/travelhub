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
  additionalTitles: string[];
};

function getTransportKind(title: string): 'flight' | 'ground' | 'cruise' | 'arrow' {
  const t = title.toLowerCase();
  if (t.includes('flight')) return 'flight';
  if (t.includes('cruise')) return 'cruise';
  if (t.includes('transport')) return 'ground';
  return 'arrow';
}

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

export const RouteStrip: React.FC = () => {
  const { trip, tripDays, selectedDayId, setSelectedDayId, localEntries } = useTripWorkspace();
  const { placeById } = usePlaces();

  const orderedDays = React.useMemo(() => {
    if (!trip) return [];
    return tripDays.filter((d) => d.tripId === trip.id).sort((a, b) => a.dayNumber - b.dayNumber);
  }, [trip, tripDays]);

  const stops = React.useMemo((): Stop[] => {
    const parseAdditional = (value: unknown): string[] => {
      if (Array.isArray(value)) return value.map((x) => String(x).trim()).filter(Boolean);
      if (typeof value === 'string') return value.split(',').map((x) => x.trim()).filter(Boolean);
      return [];
    };
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
        dayId: day.id,
        additionalTitles: parseAdditional((day as unknown as { additionalPlaceIds?: string[] | string }).additionalPlaceIds)
          .map((id) => placeById(id)?.title)
          .filter(Boolean) as string[]
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
          const transitionEntries = next ? entries.filter((e) => e.dayId === next.dayId) : [];
          // eslint-disable-next-line no-console
          console.log('RouteStrip transition entries', next?.dayId, transitionEntries.map((e) => ({ id: e.id, category: e.category, title: e.title })));
          const transitionEntry = transitionEntries[0];
          const kind = getTransportKind(transitionEntries.map((e) => e.category).join(' '));
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
                {s.additionalTitles.length ? <span className={styles.range}>+ {s.additionalTitles.join(', ')}</span> : null}
              </button>
              {next ? (
                <span className={styles.connector}>
                  <TransportIcon kind={kind} />
                </span>
              ) : null}
            </React.Fragment>
          );
        })}
      </div>
    </section>
  );
};
