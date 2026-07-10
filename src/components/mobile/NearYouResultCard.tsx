import * as React from 'react';
import {
  placeQueryDirectionsUrl,
  placeWebsiteSearchUrl
} from '../../utils/googleMapsLink';
import type { NearYouCachedResult } from '../../utils/nearYouResultCache';
import styles from './NearYouResultCard.module.css';

export type NearYouResultCardData = NearYouCachedResult;

export interface NearYouResultCardProps {
  result: NearYouResultCardData;
  categoryLabel: string;
  onSave?: () => void;
  onAddToItinerary?: () => void;
  saveLabel?: string;
}

function IconDirections(): React.ReactElement {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden>
      <path d="M12 2 4 20l8-4 8 4L12 2Z" stroke="currentColor" strokeWidth="1.6" strokeLinejoin="round" />
    </svg>
  );
}

function IconSave(): React.ReactElement {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden>
      <path d="M6 4h12v18l-6-4-6 4V4Z" stroke="currentColor" strokeWidth="1.6" strokeLinejoin="round" />
    </svg>
  );
}

function IconItinerary(): React.ReactElement {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden>
      <rect x="4" y="5" width="16" height="15" rx="2" stroke="currentColor" strokeWidth="1.6" />
      <path d="M8 3v4M16 3v4M12 11v5M9.5 13.5H14.5" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
    </svg>
  );
}

function IconWebsite(): React.ReactElement {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden>
      <rect x="4" y="6" width="16" height="14" rx="2" stroke="currentColor" strokeWidth="1.6" />
      <path d="M8 6V4h8v2M10 11h4" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
    </svg>
  );
}

export const NearYouResultCard: React.FC<NearYouResultCardProps> = ({
  result,
  categoryLabel,
  onSave,
  onAddToItinerary,
  saveLabel = 'Save'
}) => {
  const directions = placeQueryDirectionsUrl(result.name, result.address) || result.mapsUrl;
  const website = result.websiteUrl || placeWebsiteSearchUrl(result.name, result.address);
  const meta = [categoryLabel, result.priceLevel, result.note].filter(Boolean).join(' · ');

  return (
    <article className={styles.card}>
      <div className={styles.cardTop}>
        <div className={styles.thumb} aria-hidden>
          {result.name.slice(0, 1).toUpperCase()}
        </div>
        <div className={styles.cardMain}>
          <div className={styles.cardTitleRow}>
            <h3 className={styles.cardTitle}>{result.name}</h3>
            {typeof result.rating === 'number' ? (
              <span className={styles.rating}>★ {result.rating.toFixed(1)}</span>
            ) : null}
          </div>
          {result.topPick ? <span className={styles.badge}>AI TOP PICK</span> : null}
          {meta ? <p className={styles.cardMeta}>{meta}</p> : null}
          {result.address ? <p className={styles.cardAddr}>{result.address}</p> : null}
          {result.aiBlurb ? (
            <p className={styles.aiSays}>
              <strong>AI says:</strong> {result.aiBlurb}
            </p>
          ) : null}
        </div>
      </div>
      <div className={styles.actions}>
        {directions ? (
          <a className={styles.actionBtn} href={directions} target="_blank" rel="noopener noreferrer" title="Directions">
            <IconDirections />
            <span>Directions</span>
          </a>
        ) : (
          <span className={styles.actionBtnDisabled}>
            <IconDirections />
            <span>Directions</span>
          </span>
        )}
        {onSave ? (
          <button type="button" className={styles.actionBtn} onClick={onSave} title={saveLabel}>
            <IconSave />
            <span>{saveLabel}</span>
          </button>
        ) : null}
        {onAddToItinerary ? (
          <button type="button" className={styles.actionBtn} onClick={onAddToItinerary} title="Add to itinerary">
            <IconItinerary />
            <span>Add to itinerary</span>
          </button>
        ) : null}
        {website ? (
          <a className={styles.actionBtn} href={website} target="_blank" rel="noopener noreferrer" title="Website">
            <IconWebsite />
            <span>Website</span>
          </a>
        ) : null}
      </div>
    </article>
  );
};
