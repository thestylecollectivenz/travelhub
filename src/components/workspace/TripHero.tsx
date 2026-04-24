import * as React from 'react';
import type { Trip, TripLifecycleStatus } from '../../models/Trip';
import { formatDateRange } from '../../utils/dateUtils';
import { joinWebAbsoluteAndServerRelative } from '../../utils/sharePointUrl';
import { useSpContext } from '../../context/SpContext';
import styles from './TripHero.module.css';

export interface TripHeroProps {
  trip: Trip;
  onEdit: () => void;
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

/** Accept absolute http(s), protocol-relative, and SharePoint server-relative paths. */
function resolveHeroImageSrc(raw: string, webAbsoluteUrl: string, webServerRelativeUrl: string): string | null {
  const trimmed = raw.trim();
  if (!trimmed) return null;
  if (/^https:\/\//i.test(trimmed)) return trimmed;
  if (/^http:\/\//i.test(trimmed)) {
    if (typeof window !== 'undefined' && window.isSecureContext) {
      return `https://${trimmed.slice('http://'.length)}`;
    }
    return trimmed;
  }
  if (trimmed.startsWith('//')) return `${window.location.protocol}${trimmed}`;
  const base = webAbsoluteUrl.replace(/\/$/, '');
  const webRoot = webServerRelativeUrl.replace(/\/$/, '');
  if (trimmed.startsWith('/')) {
    return joinWebAbsoluteAndServerRelative(base, trimmed);
  }
  const rel = trimmed.replace(/^\/+/, '');
  if (webRoot) {
    return joinWebAbsoluteAndServerRelative(base, `${webRoot}/${rel}`);
  }
  return joinWebAbsoluteAndServerRelative(base, `/${rel}`);
}

export const TripHero: React.FC<TripHeroProps> = ({ trip, onEdit }) => {
  const spContext = useSpContext();
  const webAbsoluteUrl = spContext.pageContext.web.absoluteUrl.replace(/\/$/, '');
  const webServerRelativeUrl = spContext.pageContext.web.serverRelativeUrl.replace(/\/$/, '');
  const heroImageUrl = trip.heroImageUrl?.trim() ?? '';
  const heroImageSrc = React.useMemo(
    () => resolveHeroImageSrc(heroImageUrl, webAbsoluteUrl, webServerRelativeUrl),
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
        <button type="button" className={styles.editButton} onClick={onEdit} aria-label="Edit trip details">
          <svg viewBox="0 0 16 16" width={12} height={12} fill="none" aria-hidden>
            <path d="M3 11.8 11.6 3.2l1.2 1.2L4.2 13H3v-1.2Z" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" />
            <path d="M9.9 4.9 11.1 6.1" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
          </svg>
        </button>
        <div className={styles.statusChip}>
          <span className={`${styles.statusDot} ${statusDotClass(trip.status)}`} aria-hidden />
          <span>{trip.status}</span>
        </div>
        <div className={styles.heroBody}>
          <h1 className={styles.title}>{trip.title}</h1>
          <p className={styles.meta}>{metaLine}</p>
          {countdown ? <span className={`${styles.countdownChip} ${countdownClass}`}>{countdown}</span> : null}
          {showDescription ? <p className={styles.description}>{trip.description}</p> : null}
        </div>
      </div>
    </section>
  );
};
