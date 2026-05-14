import * as React from 'react';
import type { Trip, TripLifecycleStatus } from '../../models/Trip';
import type { TripDay } from '../../models/TripDay';
import type { ItineraryEntry } from '../../models/ItineraryEntry';
import { formatDateRange } from '../../utils/dateUtils';
import { resolveSharePointMediaSrc } from '../../utils/sharePointUrl';
import { haversineKm, kmToMiles, formatDistance } from '../../utils/distanceUtils';
import { useSpContext } from '../../context/SpContext';
import { useTripWorkspace } from '../../context/TripWorkspaceContext';
import { usePlaces } from '../../context/PlacesContext';
import { useConfig } from '../../context/ConfigContext';
import styles from './TripHero.module.css';

export interface TripHeroProps {
  trip: Trip;
  onEdit: () => void;
  /** When false, hides the edit control (e.g. shared / follower view). */
  showEditButton?: boolean;
}

function inclusiveTripDayCount(dateStart: string, dateEnd: string): number {
  const startMs = new Date(`${dateStart}T12:00:00`).getTime();
  const endMs = new Date(`${dateEnd}T12:00:00`).getTime();
  return Math.floor((endMs - startMs) / 86400000) + 1;
}

function statusDotClass(status: TripLifecycleStatus): string {
  switch (status) {
    case 'Planning':
      return styles.dotPlanning;
    case 'Upcoming':
      return styles.dotUpcoming;
    case 'In Progress':
      return styles.dotInProgress;
    case 'Completed':
      return styles.dotCompleted;
    case 'Archived':
    default:
      return styles.dotArchived;
  }
}

function ymdFromTripDay(day: TripDay): string {
  return (day.calendarDate || '').slice(0, 10);
}

function sliceYmd(value: string | undefined): string | undefined {
  if (!value) return undefined;
  return value.slice(0, 10);
}

function departureCalendarDate(entry: ItineraryEntry, days: TripDay[]): string | undefined {
  const row = days.find((d) => d.id === entry.dayId);
  return row ? ymdFromTripDay(row) : undefined;
}

function countdownLabel(trip: Trip): string | null {
  if (trip.status === 'Completed' || trip.status === 'Archived') {
    return null;
  }
  if (trip.status === 'In Progress') {
    return 'In progress';
  }

  const today = new Date();
  const start = new Date(`${trip.dateStart}T00:00:00`);
  const todayLocal = new Date(today.getFullYear(), today.getMonth(), today.getDate());
  const startLocal = new Date(start.getFullYear(), start.getMonth(), start.getDate());
  const diffDays = Math.floor((startLocal.getTime() - todayLocal.getTime()) / 86400000);

  if (diffDays > 0) {
    return diffDays === 1 ? '1 day to go' : `${diffDays} days to go`;
  }
  if (diffDays === 0) {
    return 'Starts today';
  }
  return null;
}

export const TripHero: React.FC<TripHeroProps> = ({ trip, onEdit, showEditButton = true }) => {
  const spContext = useSpContext();
  const { tripDays, localEntries } = useTripWorkspace();
  const { placeById } = usePlaces();
  const { config } = useConfig();
  const webAbsoluteUrl = spContext.pageContext.web.absoluteUrl.replace(/\/$/, '');
  const webServerRelativeUrl = spContext.pageContext.web.serverRelativeUrl.replace(/\/$/, '');
  const heroImageUrl = trip.heroImageUrl?.trim() ?? '';
  const heroImageSrc = React.useMemo(
    () => resolveSharePointMediaSrc(heroImageUrl, webAbsoluteUrl, webServerRelativeUrl),
    [heroImageUrl, webAbsoluteUrl, webServerRelativeUrl]
  );
  const [heroImageFailed, setHeroImageFailed] = React.useState(false);

  React.useEffect(() => {
    setHeroImageFailed(false);
  }, [heroImageSrc]);

  const hasHeroImage = Boolean(heroImageSrc) && !heroImageFailed;
  const dayCount = inclusiveTripDayCount(trip.dateStart, trip.dateEnd);
  const dayLabel = dayCount === 1 ? '1 day' : `${dayCount} days`;
  const metaLine = `${trip.destination} · ${formatDateRange(trip.dateStart, trip.dateEnd)} · ${dayLabel}`;
  const showDescription = Boolean(trip.description && trip.description.trim() !== '');
  const countdown = countdownLabel(trip);
  const countdownClass = trip.status === 'In Progress' ? styles.countdownInProgress : styles.countdownUpcoming;
  const distanceLine = React.useMemo(() => {
    const days = tripDays.filter((d) => d.tripId === trip.id).sort((a, b) => a.dayNumber - b.dayNumber);
    const stops: Array<{ day: TripDay; lat: number; lon: number }> = [];
    for (const day of days) {
      const place = placeById(day.primaryPlaceId);
      if (!place) continue;
      const prev = stops[stops.length - 1];
      if (prev && Math.abs(prev.lat - place.latitude) < 0.00001 && Math.abs(prev.lon - place.longitude) < 0.00001) {
        continue;
      }
      stops.push({ day, lat: place.latitude, lon: place.longitude });
    }
    if (stops.length < 2) return '';
    const entries = localEntries.filter((e) => e.tripId === trip.id && !e.parentEntryId);
    let airKm = 0;
    let groundKm = 0;
    let waterKm = 0;
    for (let i = 0; i < stops.length - 1; i++) {
      const dayA = stops[i].day;
      const dayB = stops[i + 1].day;
      const aCal = ymdFromTripDay(dayA);
      const bCal = ymdFromTripDay(dayB);
      const a = stops[i];
      const b = stops[i + 1];
      const km = haversineKm(a.lat, a.lon, b.lat, b.lon);

      const overnightFlightConnectsDays = entries.some((e) => {
        if (e.category !== 'Flights') return false;
        const dep = departureCalendarDate(e, days);
        const arr = sliceYmd(e.arrivalDate) ?? dep;
        if (!dep || !arr) return false;
        return dep === aCal && arr === bCal;
      });

      const cruiseSpanCoversBoth = entries.some((e) => {
        if (e.category !== 'Cruise') return false;
        const es = sliceYmd(e.embarksDate);
        const ed = sliceYmd(e.disembarksDate);
        if (!es || !ed) return false;
        return aCal >= es && aCal <= ed && bCal >= es && bCal <= ed;
      });

      if (overnightFlightConnectsDays) airKm += km;
      else if (cruiseSpanCoversBoth) waterKm += km;
      else groundKm += km;
    }
    const unit = config.distanceUnit;
    const air = unit === 'Miles' ? kmToMiles(airKm) : airKm;
    const ground = unit === 'Miles' ? kmToMiles(groundKm) : groundKm;
    const water = unit === 'Miles' ? kmToMiles(waterKm) : waterKm;
    const parts: string[] = [];
    if (air > 0.5) parts.push(`~${formatDistance(air, unit)} by air`);
    if (ground > 0.5) parts.push(`~${formatDistance(ground, unit)} by ground`);
    if (water > 0.5) parts.push(`~${formatDistance(water, unit)} by water`);
    return parts.length ? parts.join(' · ') : '';
  }, [tripDays, trip.id, placeById, localEntries, config.distanceUnit]);

  return (
    <section className={`${styles.hero} ${hasHeroImage ? styles.heroWithImage : styles.heroNoImage}`} aria-label="Trip hero">
      {hasHeroImage ? (
        <img
          className={styles.heroImageLayer}
          src={heroImageSrc ?? ''}
          alt=""
          role="presentation"
          aria-hidden
          onError={() => {
            // eslint-disable-next-line no-console
            console.warn('TripHero: hero image failed to load', heroImageSrc);
            setHeroImageFailed(true);
          }}
        />
      ) : null}
      <div className={`${styles.heroOverlay} ${hasHeroImage ? styles.heroOverlayWithImage : styles.heroOverlayNoImage}`} role="presentation" />
      <div className={`${styles.heroForeground} ${hasHeroImage ? styles.heroForegroundImage : ''}`}>
        <div className={styles.badge}>✦ Travel Hub</div>
        {showEditButton ? (
          <button type="button" className={styles.editButton} onClick={onEdit} aria-label="Edit trip details">
            <svg viewBox="0 0 16 16" width={12} height={12} fill="none" aria-hidden>
              <path d="M3 11.8 11.6 3.2l1.2 1.2L4.2 13H3v-1.2Z" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" />
              <path d="M9.9 4.9 11.1 6.1" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
            </svg>
          </button>
        ) : null}
        <div className={styles.statusChip}>
          <span className={`${styles.statusDot} ${statusDotClass(trip.status)}`} aria-hidden />
          <span>{trip.status}</span>
        </div>
        <div className={styles.heroBody}>
          <h1 className={styles.title}>{trip.title}</h1>
          <p className={styles.meta}>{metaLine}</p>
          {distanceLine ? <p className={styles.meta}>{distanceLine}</p> : null}
          {countdown ? <span className={`${styles.countdownChip} ${countdownClass}`}>{countdown}</span> : null}
          {showDescription ? <p className={styles.description}>{trip.description}</p> : null}
        </div>
      </div>
    </section>
  );
};
