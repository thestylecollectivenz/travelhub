import * as React from 'react';
import type { Trip, TripLifecycleStatus } from '../../models/Trip';
import { formatDateRange } from '../../utils/dateUtils';
import styles from './TripHero.module.css';

export interface TripHeroProps {
  trip: Trip;
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

export const TripHero: React.FC<TripHeroProps> = ({ trip }) => {
  const hasHeroImage = Boolean(trip.heroImageUrl && trip.heroImageUrl.trim() !== '');
  const dayCount = inclusiveTripDayCount(trip.dateStart, trip.dateEnd);
  const dayLabel = dayCount === 1 ? '1 day' : `${dayCount} days`;
  const metaLine = `${trip.destination} · ${formatDateRange(trip.dateStart, trip.dateEnd)} · ${dayLabel}`;
  const showDescription = Boolean(trip.description && trip.description.trim() !== '');

  return (
    <section className={styles.hero} aria-label="Trip hero">
      {hasHeroImage ? (
        <div
          className={styles.heroImageLayer}
          style={{ backgroundImage: `url(${trip.heroImageUrl})` }}
          role="presentation"
        />
      ) : null}
      <div className={styles.heroOverlay} role="presentation" />
      <div className={styles.heroForeground}>
        <div className={styles.badge}>✦ Travel Hub</div>
        <div className={styles.statusChip}>
          <span className={`${styles.statusDot} ${statusDotClass(trip.status)}`} aria-hidden />
          <span>{trip.status}</span>
        </div>
        <div className={styles.heroBody}>
          <h1 className={styles.title}>{trip.title}</h1>
          <p className={styles.meta}>{metaLine}</p>
          {showDescription ? <p className={styles.description}>{trip.description}</p> : null}
        </div>
      </div>
    </section>
  );
};
