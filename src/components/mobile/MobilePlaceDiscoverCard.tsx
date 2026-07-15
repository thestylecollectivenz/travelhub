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
  description?: string;
  distanceRaw?: string;
  address?: string;
  mapsUrl?: string;
  tags?: string[];
  city?: string;
  nearLabel?: string;
};

export type PlaceDiscoverPrimaryKind = 'save' | 'delete' | 'label';

export interface MobilePlaceDiscoverCardProps {
  card: PlaceDiscoverCardModel;
  startingPointLabel: string;
  cityFallback: string;
  layout?: 'strip' | 'list';
  primaryAction?: {
    label: string;
    onClick: () => void;
    kind?: PlaceDiscoverPrimaryKind;
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

function IconSave(): React.ReactElement {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden>
      <path d="M6 4h12v18l-6-4-6 4V4Z" stroke="currentColor" strokeWidth="1.7" strokeLinejoin="round" />
    </svg>
  );
}

function IconDelete(): React.ReactElement {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden>
      <path
        d="M5 7h14M10 7V5h4v2m-6 3v8m4-8v8M7 7l1 13h8l1-13"
        stroke="currentColor"
        strokeWidth="1.7"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

export const MobilePlaceDiscoverCard: React.FC<MobilePlaceDiscoverCardProps> = ({
  card,
  startingPointLabel,
  cityFallback,
  layout = 'list',
  primaryAction
}) => {
  const city = card.city || cityFallback;
  const photo = explorePlacePhotoUrl(card.name, city);
  const dist = distanceDisplayWithWalk(card.distanceRaw, card.nearLabel || startingPointLabel);
  const directions = placeDirectionsFromHereUrl(card.name, card.address, city) || undefined;
  const kind = primaryAction?.kind || 'label';

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
              className={`${styles.action} ${styles.actionDirections}`}
              href={directions}
              target="_blank"
              rel="noopener noreferrer"
            >
              <IconDirections /> Directions
            </a>
          ) : null}
          {primaryAction ? (
            <button
              type="button"
              className={`${styles.action} ${kind === 'delete' ? styles.actionIconDanger : ''} ${
                kind !== 'label' ? styles.actionIcon : ''
              }`}
              onClick={primaryAction.onClick}
              aria-label={primaryAction.label}
              title={primaryAction.label}
            >
              {kind === 'save' ? <IconSave /> : null}
              {kind === 'delete' ? <IconDelete /> : null}
              {kind === 'label' ? primaryAction.label : null}
            </button>
          ) : null}
        </div>
      </div>
    </article>
  );
};
