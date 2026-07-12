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

function DiningRow(props: { row: DiningSuggestionRow; readOnly: boolean; onToggleDone: () => void }): React.ReactElement {
  return (
    <li className={styles.savedRow}>
      <label className={styles.highlightCheck}>
        <input type="checkbox" checked={Boolean(props.row.done)} disabled={props.readOnly} onChange={props.onToggleDone} />
        <span className={props.row.done ? styles.done : undefined}>{props.row.name}</span>
      </label>
      {(props.row.bestFor || props.row.description || props.row.why) ? (
        <p className={styles.savedMeta}>{props.row.bestFor || props.row.description || props.row.why}</p>
      ) : null}
      <PlaceRowLinks name={props.row.name} mapsUrl={props.row.mapsUrl} websiteUrl={props.row.websiteUrl} />
    </li>
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
          <ul className={styles.savedList}>
            {dining.map((row) => (
              <DiningRow
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
          </ul>
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
