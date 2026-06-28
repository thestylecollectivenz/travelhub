import * as React from 'react';
import type { ItineraryEntry } from '../../models/ItineraryEntry';
import { useAttachments } from '../../context/AttachmentsContext';
import { CategoryIcon } from '../shared/CategoryIcon';
import { getCategorySlug } from '../../utils/categoryUtils';
import { formatTimeHHMM } from '../../utils/itineraryTimeUtils';
import { isLocationInfoEntry } from '../../utils/locationInfoEntry';
import { isRichTextEditorEmpty } from '../../utils/journalRichText';
import { SharedLocationInfoBlock } from '../itinerary/SharedLocationInfoBlock';
import { RichTextContent } from '../shared/RichTextContent';
import styles from './MobileShell.module.css';

export interface MobileCardDetailProps {
  entry: ItineraryEntry;
  onClose: () => void;
}

function mapsUrl(entry: ItineraryEntry): string | null {
  const q = (entry.location || entry.streetAddress || '').trim();
  if (!q) return null;
  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(q)}`;
}

export const MobileCardDetail: React.FC<MobileCardDetailProps> = ({ entry, onClose }) => {
  const { documents, links } = useAttachments();
  const entryDocs = documents.filter((d) => d.entryId === entry.id);
  const entryLinks = links.filter((l) => l.entryId === entry.id);
  const mapLink = mapsUrl(entry);
  const isLocationInfo = isLocationInfoEntry(entry);
  const hasNotes = !isLocationInfo && !isRichTextEditorEmpty(entry.notes);

  return (
    <div className={styles.detailPanel}>
      <button type="button" className={styles.detailBackBtn} onClick={onClose}>
        ← Back
      </button>
      <div className={`th-cat-${getCategorySlug(entry.category)} ${styles.detailTitleRow}`}>
        <CategoryIcon category={entry.category} />
        <h2 className={styles.cardTitle}>{entry.title}</h2>
      </div>
      <p className={styles.cardMeta}>
        {entry.category} · {entry.decisionStatus}
        {entry.timeStart ? ` · ${formatTimeHHMM(entry.timeStart)}` : ''}
      </p>
      {entry.location || entry.streetAddress ? (
        <p className={styles.muted}>{entry.location || entry.streetAddress}</p>
      ) : null}
      {entry.category === 'Accommodation' && entry.roomType ? <p className={styles.muted}>Room: {entry.roomType}</p> : null}
      {entry.category === 'Flights' && entry.flightNumbers ? <p className={styles.muted}>Flight: {entry.flightNumbers}</p> : null}
      {entry.notes && !isLocationInfo && hasNotes ? (
        <div className={styles.detailNotes}>
          <RichTextContent html={entry.notes} />
        </div>
      ) : null}
      {isLocationInfo ? <SharedLocationInfoBlock entry={entry} /> : null}
      {mapLink ? (
        <a className={styles.linkBtn} href={mapLink} target="_blank" rel="noopener noreferrer">
          Open in Google Maps
        </a>
      ) : null}
      {entryDocs.length ? (
        <div>
          <h3 className={styles.sectionHeading}>Documents</h3>
          {entryDocs.map((d) => (
            <a key={d.id} className={styles.linkBtn} href={d.fileUrl} target="_blank" rel="noopener noreferrer">
              {d.title || 'Document'}
            </a>
          ))}
        </div>
      ) : null}
      {entryLinks.length ? (
        <div>
          <h3 className={styles.sectionHeading}>Links</h3>
          {entryLinks.map((l) => (
            <a key={l.id} className={styles.linkBtn} href={l.url} target="_blank" rel="noopener noreferrer">
              {l.linkTitle || l.title || l.url}
            </a>
          ))}
        </div>
      ) : null}
    </div>
  );
};
