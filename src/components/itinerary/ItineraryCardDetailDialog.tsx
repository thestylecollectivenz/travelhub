import * as React from 'react';
import * as ReactDOM from 'react-dom';
import type { ItineraryEntry } from '../../models/ItineraryEntry';
import { useAttachments } from '../../context/AttachmentsContext';
import { useCanSeeFinancials } from '../../hooks/useCanSeeFinancials';
import { CategoryIcon } from '../shared/CategoryIcon';
import { getCategorySlug } from '../../utils/categoryUtils';
import { buildItineraryEntryDetailRows } from '../../utils/itineraryEntryDetailFields';
import { isLocationInfoEntry } from '../../utils/locationInfoEntry';
import { SharedLocationInfoBlock } from './SharedLocationInfoBlock';
import { entryMapsDirectionsUrl, entryMapsPlaceUrl } from '../../utils/googleMapsLink';
import cardStyles from './ItineraryCard.module.css';
import styles from './ItineraryCardDetailDialog.module.css';

export interface ItineraryCardDetailDialogProps {
  entry: ItineraryEntry;
  onClose: () => void;
  onEdit?: () => void;
}

export const ItineraryCardDetailDialog: React.FC<ItineraryCardDetailDialogProps> = ({ entry, onClose, onEdit }) => {
  const { documents, links } = useAttachments();
  const canSeeFinancials = useCanSeeFinancials();
  const isLocationInfo = isLocationInfoEntry(entry);
  const rows = React.useMemo(
    () => buildItineraryEntryDetailRows(entry, { canSeeFinancials }),
    [entry, canSeeFinancials]
  );
  const entryDocs = documents.filter((d) => d.entryId === entry.id);
  const entryLinks = links.filter((l) => l.entryId === entry.id);
  const mapsPlaceUrl = entryMapsPlaceUrl(entry);
  const mapsDirectionsUrl = entryMapsDirectionsUrl(entry);

  React.useEffect(() => {
    const onKey = (ev: KeyboardEvent): void => {
      if (ev.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [onClose]);

  if (typeof document === 'undefined') return null;

  const panel = (
    <div className={styles.backdrop} role="presentation" onClick={onClose}>
      <div
        className={styles.dialog}
        role="dialog"
        aria-modal="true"
        aria-label={`Details — ${entry.title || entry.category}`}
        onClick={(e) => e.stopPropagation()}
      >
        <header className={styles.header}>
          <div className={styles.titleRow}>
            <span className={`${styles.categoryBadge} th-cat-${getCategorySlug(entry.category)} th-cat-badge`}>
              <CategoryIcon category={entry.category} size={14} color="currentColor" />
              {entry.category}
            </span>
            <h2 className={styles.title}>{entry.title || 'Untitled'}</h2>
          </div>
          <div className={styles.headerActions}>
            {onEdit ? (
              <button type="button" className={styles.headerBtn} onClick={onEdit}>
                Edit
              </button>
            ) : null}
            <button type="button" className={styles.closeBtn} aria-label="Close" onClick={onClose}>
              ×
            </button>
          </div>
        </header>
        <div className={styles.body}>
          {isLocationInfo ? (
            <SharedLocationInfoBlock entry={entry} />
          ) : (
            <dl className={styles.detailList}>
              {rows.map((r) => (
                <div key={r.label} className={styles.detailRow}>
                  <dt className={styles.detailLabel}>{r.label}</dt>
                  <dd className={styles.detailValue}>{r.value}</dd>
                </div>
              ))}
            </dl>
          )}
          {!isLocationInfo && mapsPlaceUrl ? (
            <div className={styles.mapsRow}>
              <a className={styles.linkBtn} href={mapsPlaceUrl} target="_blank" rel="noopener noreferrer">
                Open in Google Maps
              </a>
              {mapsDirectionsUrl ? (
                <a className={styles.linkBtn} href={mapsDirectionsUrl} target="_blank" rel="noopener noreferrer">
                  Get directions
                </a>
              ) : null}
            </div>
          ) : null}
          {entryDocs.length ? (
            <section className={styles.attachSection}>
              <h3 className={styles.sectionHeading}>Documents</h3>
              <ul className={styles.linkList}>
                {entryDocs.map((d) => (
                  <li key={d.id}>
                    <a className={styles.linkBtn} href={d.fileUrl} target="_blank" rel="noopener noreferrer">
                      {d.title || d.documentType || 'Document'}
                    </a>
                  </li>
                ))}
              </ul>
            </section>
          ) : null}
          {entryLinks.length ? (
            <section className={styles.attachSection}>
              <h3 className={styles.sectionHeading}>Links</h3>
              <ul className={styles.linkList}>
                {entryLinks.map((l) => (
                  <li key={l.id}>
                    <a className={styles.linkBtn} href={l.url} target="_blank" rel="noopener noreferrer">
                      {l.linkTitle || l.title || l.url}
                    </a>
                  </li>
                ))}
              </ul>
            </section>
          ) : null}
        </div>
      </div>
    </div>
  );

  return ReactDOM.createPortal(
    <div className={cardStyles.portalEditRoot} role="presentation">
      {panel}
    </div>,
    document.body
  );
};
