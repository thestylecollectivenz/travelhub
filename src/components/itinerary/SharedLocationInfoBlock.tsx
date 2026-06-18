import * as React from 'react';
import {
  isLocationInfoEntry,
  locationHighlightRows,
  normalizeLocationInfoNotes,
  parseLocationInfoNotes
} from '../../utils/locationInfoEntry';
import type { ItineraryEntry } from '../../models/ItineraryEntry';
import { RichTextContent } from '../shared/RichTextContent';
import { LocationInfoHighlights } from './LocationInfoHighlights';
import styles from './SharedItinerarySummary.module.css';

export interface SharedLocationInfoBlockProps {
  entry: ItineraryEntry;
}

export const SharedLocationInfoBlock: React.FC<SharedLocationInfoBlockProps> = ({ entry }) => {
  if (!isLocationInfoEntry(entry)) return null;
  const data = parseLocationInfoNotes(entry.notes);
  if (!data) return null;
  const normalized = normalizeLocationInfoNotes(data);

  return (
    <div className={styles.locationInfoBlock}>
      <div className={styles.locationInfoTitle}>{entry.title || 'Location'}</div>
      {normalized.overview.trim() ? (
        <div className={styles.locationInfoOverview}>
          <RichTextContent html={normalized.overview.trim()} />
        </div>
      ) : null}
      <LocationInfoHighlights rows={locationHighlightRows(normalized)} onChange={() => undefined} readOnly />
    </div>
  );
};
