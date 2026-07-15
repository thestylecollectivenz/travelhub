import * as React from 'react';
import { explorePlacePhotoUrl } from '../../utils/explorePlacePhoto';
import { placeDirectionsFromHereUrl } from '../../utils/googleMapsLink';
import { distanceDisplayWithWalk } from '../../utils/locationDistanceLabel';
import styles from './MobilePlaceDiscoverCard.module.css';

export type PlaceDiscoverCardModel = {
  id: string;
  name: string;
  categoryLabel: string;
  rating?: number;
  /** Longer description / why / services. */
  description?: string;
  /** Raw distance text e.g. "450 m". */
  distanceRaw?: string;
  address?: string;
  mapsUrl?: string;
  tags?: string[];
  city?: string;
  nearLabel?: string;
};

export interface MobilePlaceDiscoverCardProps {
  card: PlaceDiscoverCardModel;
  startingPointLabel: string;
  cityFallback: string;
  /** Horizontal strip layout (location overview) vs vertical list (saved/explore pages). */
  layout?: 'strip' | 'list';
  primaryAction?: {
    label: string;
    onClick: () => void;
  };
  secondaryAction?: {
    label: string;
    onClick?: () => void;
    href?: string;
  };
}

function IconPin(): React.ReactElement {
  return (
    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" aria-hidden>
      <path d="M12 21s7-4.35 7-10a7 7 0 1 0-14 0c0 5.65 7 10 7 10Z" stroke="currentColor" strokeWidth="1.6" />
      <circle cx="12" cy="11" r="2" fill="currentColor" />
    </svg>
  );
}

function IconDirections(): React.ReactElement {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" aria-hidden>
      <path d="M12 2 4 20l8-4 8 4L12 2Z" stroke="currentColor" strokeWidth="1.6" strokeLinejoin="round" />
    </svg>
  );
}

export const MobilePlaceDiscoverCard: React.FC<MobilePlaceDiscoverCardProps> = ({
  card,
  startingPointLabel,
  cityFallback,
  layout = 'list',
  primaryAction,
  secondaryAction
}) => {
  const city = card.city || cityFallback;
  const photo = explorePlacePhotoUrl(card.name, city);
  const dist = distanceDisplayWithWalk(card.distanceRaw, card.nearLabel || startingPointLabel);
  const directions =
    secondaryAction?.href ||
    placeDirectionsFromHereUrl(card.name, card.address, city) ||
    undefined;

  return (
    <article className={`${styles.card} ${layout === 'strip' ? styles.strip : styles.list}`}>
      <div className={styles.photo} style={{ backgroundImage: `url(${photo})` }} aria-hidden />
      <div className={styles.body}>
        <div className={styles.titleRow}>
          <strong className={styles.name}>{card.name}</strong>
          {typeof card.rating === 'number' ? (
            <span className={styles.rating}>★ {card.rating.toFixed(1)}</span>
          ) : null}
        </div>
        <span className={styles.tag}>{card.categoryLabel}</span>
        {card.description ? <p className={styles.desc}>{card.description}</p> : null}
        {card.address ? <p className={styles.addr}>{card.address}</p> : null}
        {dist ? (
          <p className={styles.dist}>
            <IconPin /> {dist}
          </p>
        ) : null}
        {card.tags?.length ? (
          <div className={styles.tagRow}>
            {card.tags.slice(0, 3).map((t) => (
              <span key={t} className={styles.miniTag}>
                {t}
              </span>
            ))}
          </div>
        ) : null}
        <div className={styles.actions}>
          {directions ? (
            <a
              className={`${styles.action} ${styles.actionPrimary}`}
              href={directions}
              target="_blank"
              rel="noopener noreferrer"
              onClick={secondaryAction?.onClick}
            >
              <IconDirections /> Directions
            </a>
          ) : null}
          {primaryAction ? (
            <button type="button" className={styles.action} onClick={primaryAction.onClick}>
              {primaryAction.label}
            </button>
          ) : null}
        </div>
      </div>
    </article>
  );
};
