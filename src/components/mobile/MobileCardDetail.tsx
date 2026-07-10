import * as React from 'react';
import type { ItineraryEntry } from '../../models/ItineraryEntry';
import { useAttachments } from '../../context/AttachmentsContext';
import { useTripWorkspace } from '../../context/TripWorkspaceContext';
import { CategoryIcon } from '../shared/CategoryIcon';
import { getCategorySlug } from '../../utils/categoryUtils';
import { formatTimeHHMM } from '../../utils/itineraryTimeUtils';
import { isLocationInfoEntry } from '../../utils/locationInfoEntry';
import { isRichTextEditorEmpty } from '../../utils/journalRichText';
import { SharedLocationInfoBlock } from '../itinerary/SharedLocationInfoBlock';
import { RichTextContent } from '../shared/RichTextContent';
import { entryMapsDirectionsUrl, entryMapsPlaceUrl } from '../../utils/googleMapsLink';
import { useCanSeeFinancials } from '../../hooks/useCanSeeFinancials';
import { buildItineraryEntryDetailRows } from '../../utils/itineraryEntryDetailFields';
import styles from './MobileCardDetail.module.css';

export interface MobileCardDetailProps {
  entry: ItineraryEntry;
  onClose: () => void;
}

function chipIcon(kind: 'star' | 'dot' | 'clock'): React.ReactNode {
  if (kind === 'star') {
    return (
      <svg width="10" height="10" viewBox="0 0 12 12" fill="none" aria-hidden>
        <path d="M6 1.2 7.4 4.6l3.6.3-2.7 2.3.8 3.5L6 9.1 3 10.7l.8-3.5L1 4.9l3.6-.3L6 1.2Z" fill="currentColor" />
      </svg>
    );
  }
  if (kind === 'clock') {
    return (
      <svg width="10" height="10" viewBox="0 0 12 12" fill="none" aria-hidden>
        <circle cx="6" cy="6" r="4.5" stroke="currentColor" strokeWidth="1.2" />
        <path d="M6 3.5V6l2 1.2" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" />
      </svg>
    );
  }
  return <span className={styles.dot} aria-hidden />;
}

export const MobileCardDetail: React.FC<MobileCardDetailProps> = ({ entry, onClose }) => {
  const { trip } = useTripWorkspace();
  const { documents, links } = useAttachments();
  const canSeeFinancials = useCanSeeFinancials();
  const entryDocs = documents.filter((d) => d.entryId === entry.id);
  const entryLinks = links.filter((l) => l.entryId === entry.id);
  const mapsPlaceUrl = entryMapsPlaceUrl(entry);
  const mapsDirectionsUrl = entryMapsDirectionsUrl(entry);
  const isLocationInfo = isLocationInfoEntry(entry);
  const hasNotes = !isLocationInfo && !isRichTextEditorEmpty(entry.notes);
  const locationLabel = (entry.location ?? '').trim();
  const streetLabel = (entry.streetAddress ?? '').trim();
  const detailRows = React.useMemo(
    () => buildItineraryEntryDetailRows(entry, { canSeeFinancials }),
    [entry, canSeeFinancials]
  );
  const slug = getCategorySlug(entry.category);
  const timeChip = entry.timeStart ? formatTimeHHMM(entry.timeStart) : entry.duration || '';

  const actions = React.useMemo(() => {
    const rows: Array<{ label: string; href?: string; onClick?: () => void }> = [];
    if (entry.category === 'Flights') {
      if (mapsPlaceUrl) rows.push({ label: 'Boarding pass', href: mapsPlaceUrl });
      if (entryLinks[0]?.url) rows.push({ label: 'Airline app', href: entryLinks[0].url });
      if (mapsDirectionsUrl) rows.push({ label: 'Directions', href: mapsDirectionsUrl });
    } else if (entry.category === 'Transport') {
      if (entryLinks[0]?.url) rows.push({ label: 'Timetable', href: entryLinks[0].url });
      if (mapsPlaceUrl) rows.push({ label: 'Map', href: mapsPlaceUrl });
      if (mapsDirectionsUrl) rows.push({ label: 'Directions', href: mapsDirectionsUrl });
    } else if (entry.category === 'Accommodation') {
      if (entryLinks[0]?.url) rows.push({ label: 'Hotel website', href: entryLinks[0].url });
      if (entry.phoneNumber) rows.push({ label: 'Call hotel', href: `tel:${entry.phoneNumber}` });
      if (entryDocs[0]?.fileUrl) rows.push({ label: 'View voucher', href: entryDocs[0].fileUrl });
      if (mapsPlaceUrl) rows.push({ label: 'Map', href: mapsPlaceUrl });
    } else if (entry.category === 'Cruise' || entry.category === 'Cruise port') {
      if (mapsPlaceUrl) rows.push({ label: 'Port map', href: mapsPlaceUrl });
      if (mapsDirectionsUrl) rows.push({ label: 'Directions', href: mapsDirectionsUrl });
      if (entryDocs[0]?.fileUrl) rows.push({ label: 'Boarding pass', href: entryDocs[0].fileUrl });
      if (entryLinks[0]?.url) rows.push({ label: 'Deck map', href: entryLinks[0].url });
    } else {
      if (entryLinks[0]?.url) rows.push({ label: 'Open booking', href: entryLinks[0].url });
      if (mapsPlaceUrl) rows.push({ label: 'View on map', href: mapsPlaceUrl });
      if (mapsDirectionsUrl) rows.push({ label: 'Directions', href: mapsDirectionsUrl });
      if (entryLinks[1]?.url) rows.push({ label: 'Website', href: entryLinks[1].url });
    }
    return rows.slice(0, 4);
  }, [entry, entryDocs, entryLinks, mapsDirectionsUrl, mapsPlaceUrl]);

  return (
    <div className={styles.page}>
      <header className={styles.topBar}>
        <button type="button" className={styles.back} onClick={onClose}>
          ← Back
        </button>
        {trip?.title ? <p className={styles.tripTitle}>{trip.title}</p> : <span />}
      </header>

      <div className={styles.hero}>
        <div className={`${styles.heroIcon} th-cat-${slug}`}>
          <CategoryIcon category={entry.category} size={28} color="white" />
        </div>
        <div className={styles.heroCopy}>
          <h1 className={styles.title}>{entry.title}</h1>
          <div className={styles.chips}>
            <span className={styles.chip}>
              {chipIcon('star')}
              {entry.category}
            </span>
            <span className={styles.chip}>
              {chipIcon('dot')}
              {entry.decisionStatus}
            </span>
            {timeChip ? (
              <span className={styles.chip}>
                {chipIcon('clock')}
                {timeChip}
              </span>
            ) : null}
          </div>
          {locationLabel ? (
            <p className={styles.location}>
              <svg width="12" height="12" viewBox="0 0 12 14" fill="none" aria-hidden>
                <path d="M6 1C3.79 1 2 2.79 2 5c0 3 4 8 4 8s4-5 4-8c0-2.21-1.79-4-4-4z" fill="currentColor" />
              </svg>
              {locationLabel}
            </p>
          ) : null}
          {streetLabel && streetLabel !== locationLabel ? <p className={styles.sub}>{streetLabel}</p> : null}
        </div>
      </div>

      {entry.category === 'Flights' && (entry.transportFrom || entry.transportTo) ? (
        <div className={styles.flightBlock}>
          <div>
            <p className={styles.flightLabel}>Departs</p>
            <p className={styles.flightTime}>{entry.timeStart ? formatTimeHHMM(entry.timeStart) : '—'}</p>
            <p className={styles.flightPlace}>{entry.transportFrom || '—'}</p>
          </div>
          <div className={styles.flightMid} aria-hidden>
            ✈
          </div>
          <div>
            <p className={styles.flightLabel}>Arrives</p>
            <p className={styles.flightTime}>{entry.arrivalTime ? formatTimeHHMM(entry.arrivalTime) : '—'}</p>
            <p className={styles.flightPlace}>{entry.transportTo || '—'}</p>
          </div>
        </div>
      ) : null}

      {!isLocationInfo && detailRows.length ? (
        <div className={styles.detailBox}>
          {detailRows.map((row) => (
            <div key={row.label} className={styles.detailRow}>
              <span className={styles.detailLabel}>{row.label}</span>
              <span className={styles.detailValue}>{row.value}</span>
            </div>
          ))}
        </div>
      ) : null}

      {entry.notes && !isLocationInfo && hasNotes ? (
        <div className={styles.notesBox}>
          <RichTextContent html={entry.notes} />
        </div>
      ) : null}

      {isLocationInfo ? <SharedLocationInfoBlock entry={entry} /> : null}

      {actions.length ? (
        <div className={styles.actions}>
          {actions.map((a) =>
            a.href ? (
              <a key={a.label} className={styles.actionBtn} href={a.href} target="_blank" rel="noopener noreferrer">
                {a.label}
              </a>
            ) : (
              <button key={a.label} type="button" className={styles.actionBtn} onClick={a.onClick}>
                {a.label}
              </button>
            )
          )}
        </div>
      ) : null}

      {entryDocs.length ? (
        <section className={styles.section}>
          <h3 className={styles.sectionTitle}>Documents</h3>
          {entryDocs.map((d) => (
            <a key={d.id} className={styles.docLink} href={d.fileUrl} target="_blank" rel="noopener noreferrer">
              {d.title || d.fileName || 'Document'}
            </a>
          ))}
        </section>
      ) : null}

      {entryLinks.length ? (
        <section className={styles.section}>
          <h3 className={styles.sectionTitle}>Links</h3>
          {entryLinks.map((l) => (
            <a key={l.id} className={styles.docLink} href={l.url} target="_blank" rel="noopener noreferrer">
              {l.linkTitle || l.title || l.url}
            </a>
          ))}
        </section>
      ) : null}
    </div>
  );
};
