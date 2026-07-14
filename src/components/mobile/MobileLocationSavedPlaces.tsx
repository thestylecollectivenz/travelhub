import * as React from 'react';
import type { DiningSuggestionRow, LocationInfoNotes, NearestPlaceKind, NearestPlaceRow } from '../../utils/locationInfoEntry';
import { NEAR_YOU_TOOLS } from '../../utils/nearYouTools';
import { placeQueryDirectionsUrl, placeQueryMapsUrl } from '../../utils/googleMapsLink';
import styles from './MobileLocationInfoContent.module.css';

function PlaceRowLinks(props: { name: string; address?: string; mapsUrl?: string; websiteUrl?: string }): React.ReactElement {
  const directions = placeQueryDirectionsUrl(props.name, props.address) || props.mapsUrl;
  const maps = props.mapsUrl || placeQueryMapsUrl(props.name, props.address);
  return (
    <div className={styles.essentialActions}>
      {directions ? (
        <a className={styles.essentialAction} href={directions} target="_blank" rel="noopener noreferrer" title="Directions" aria-label="Directions">
          ↗
        </a>
      ) : null}
      {maps ? (
        <a className={styles.essentialAction} href={maps} target="_blank" rel="noopener noreferrer" title="Map" aria-label="Map">
          ⌖
        </a>
      ) : null}
      {props.websiteUrl ? (
        <a className={styles.essentialAction} href={props.websiteUrl} target="_blank" rel="noopener noreferrer" title="Website" aria-label="Website">
          ⧉
        </a>
      ) : null}
    </div>
  );
}

function cuisinePills(row: DiningSuggestionRow): string[] {
  const raw = [row.bestFor, row.priceLevel].filter(Boolean).join(' · ');
  if (!raw.trim()) return [];
  return raw
    .split(/[,;·]/)
    .map((s) => s.trim())
    .filter(Boolean)
    .slice(0, 3);
}

function DiningCard(props: { row: DiningSuggestionRow; readOnly: boolean; onToggleDone: () => void }): React.ReactElement {
  const pills = cuisinePills(props.row);
  const distance = props.row.description || props.row.why;
  return (
    <article className={styles.diningCard}>
      <div className={styles.diningPhoto} aria-hidden>
        <svg width="28" height="28" viewBox="0 0 24 24" fill="none">
          <path d="M6 3v8M8 3v5M10 3v8M6 11v10M10 11v10" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
          <path d="M14 4c1.5 1.2 2 2.8 2 4.5S15.5 12 14 13v7" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
        </svg>
      </div>
      <div className={styles.diningBody}>
        <div className={styles.diningHead}>
          <label className={styles.diningCheck}>
            <input type="checkbox" checked={Boolean(props.row.done)} disabled={props.readOnly} onChange={props.onToggleDone} />
            <strong className={`${styles.diningName} ${props.row.done ? styles.done : ''}`}>{props.row.name}</strong>
          </label>
          {Number.isFinite(props.row.rating) ? (
            <span className={styles.diningRating}>★ {props.row.rating?.toFixed(1)}</span>
          ) : null}
        </div>
        {pills.length ? (
          <div className={styles.diningPills}>
            {pills.map((pill) => (
              <span key={pill} className={styles.diningPill}>
                {pill}
              </span>
            ))}
          </div>
        ) : null}
        {distance ? <p className={styles.diningMeta}>{distance}</p> : null}
        <PlaceRowLinks name={props.row.name} mapsUrl={props.row.mapsUrl} websiteUrl={props.row.websiteUrl} />
      </div>
    </article>
  );
}

function NearestRow(props: { row: NearestPlaceRow }): React.ReactElement {
  return (
    <li className={styles.savedRow}>
      <strong className={styles.savedName}>{props.row.name}</strong>
      {props.row.note ? <p className={styles.savedMeta}>{props.row.note}</p> : null}
      {props.row.address ? <p className={styles.savedAddr}>{props.row.address}</p> : null}
      <PlaceRowLinks name={props.row.name} address={props.row.address} mapsUrl={props.row.mapsUrl} websiteUrl={props.row.websiteUrl} />
    </li>
  );
}

export interface MobileLocationSavedPlacesProps {
  data: LocationInfoNotes;
  readOnly?: boolean;
  onChange: (next: LocationInfoNotes) => void;
}

export const MobileLocationSavedPlaces: React.FC<MobileLocationSavedPlacesProps> = ({ data, readOnly = false, onChange }) => {
  const dining = data.diningSuggestions ?? [];
  const nearest = data.nearestPlaces ?? {};
  const nearestSections = NEAR_YOU_TOOLS.filter((t) => t.kind).map((tool) => ({
    kind: tool.kind as NearestPlaceKind,
    label: tool.label,
    rows: nearest[tool.kind as NearestPlaceKind] ?? []
  })).filter((s) => s.rows.length > 0);

  if (!dining.length && !nearestSections.length) return null;

  return (
    <>
      {dining.length ? (
        <section className={styles.section}>
          <h3 className={styles.sectionTitle}>Dining suggestions</h3>
          <div className={styles.diningStrip}>
            {dining.map((row) => (
              <DiningCard
                key={row.id}
                row={row}
                readOnly={readOnly}
                onToggleDone={() =>
                  onChange({
                    ...data,
                    diningSuggestions: dining.map((x) => (x.id === row.id ? { ...x, done: !x.done } : x))
                  })
                }
              />
            ))}
          </div>
        </section>
      ) : null}
      {nearestSections.map((section) => (
        <section key={section.kind} className={styles.section}>
          <h3 className={styles.sectionTitle}>{section.label}</h3>
          <ul className={styles.savedList}>
            {section.rows.map((row) => (
              <NearestRow key={row.id} row={row} />
            ))}
          </ul>
        </section>
      ))}
    </>
  );
};
