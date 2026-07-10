import * as React from 'react';
import * as ReactDOM from 'react-dom';
import type { ItineraryEntry } from '../../models/ItineraryEntry';
import { useAttachments } from '../../context/AttachmentsContext';
import { useTripWorkspace } from '../../context/TripWorkspaceContext';
import { useTripPermissions } from '../../hooks/useTripPermissions';
import { CategoryIcon } from '../shared/CategoryIcon';
import { getCategorySlug } from '../../utils/categoryUtils';
import { formatTimeHHMM } from '../../utils/itineraryTimeUtils';
import { isLocationInfoEntry } from '../../utils/locationInfoEntry';
import { isRichTextEditorEmpty } from '../../utils/journalRichText';
import { SharedLocationInfoBlock } from '../itinerary/SharedLocationInfoBlock';
import { RichTextContent } from '../shared/RichTextContent';
import { ItineraryCardEdit } from '../itinerary/ItineraryCardEdit';
import { entryMapsDirectionsUrl, entryMapsPlaceUrl } from '../../utils/googleMapsLink';
import { useCanSeeFinancials } from '../../hooks/useCanSeeFinancials';
import { buildMobileCardSections } from '../../utils/mobileDetailSections';
import {
  bookingPartnerSearchUrls,
  effectiveBookingStatus,
  findConfirmationDocument
} from '../../utils/bookingStatusUtils';
import { MobileBookingSiteSheet } from './MobileBookingSiteSheet';
import cardStyles from '../itinerary/ItineraryCard.module.css';
import styles from './MobileCardDetail.module.css';

export interface MobileCardDetailProps {
  entry: ItineraryEntry;
  calendarDate: string;
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

function pillToneClass(tone: 'green' | 'rust' | 'red' | 'neutral'): string {
  if (tone === 'green') return styles.pillGreen;
  if (tone === 'rust') return styles.pillRust;
  if (tone === 'red') return styles.pillRed;
  return styles.pillNeutral;
}

export const MobileCardDetail: React.FC<MobileCardDetailProps> = ({ entry, calendarDate, onClose }) => {
  const { trip, editingCardId, setEditingCardId, updateEntry } = useTripWorkspace();
  const { canEditItinerary } = useTripPermissions();
  const { documents, links } = useAttachments();
  const canSeeFinancials = useCanSeeFinancials();
  const [showBookingSites, setShowBookingSites] = React.useState(false);
  const entryDocs = documents.filter((d) => d.entryId === entry.id);
  const entryLinks = links.filter((l) => l.entryId === entry.id);
  const confirmationDoc = findConfirmationDocument(entryDocs);
  const booked = effectiveBookingStatus(entry, { hasConfirmationDoc: Boolean(confirmationDoc) });
  const mapsPlaceUrl = entryMapsPlaceUrl(entry);
  const mapsDirectionsUrl = entryMapsDirectionsUrl(entry);
  const isLocationInfo = isLocationInfoEntry(entry);
  const hasNotes = !isLocationInfo && !isRichTextEditorEmpty(entry.notes);
  const locationLabel = (entry.location ?? '').trim();
  const streetLabel = (entry.streetAddress ?? '').trim();
  const { stats, sections } = React.useMemo(
    () => buildMobileCardSections(entry, { canSeeFinancials, hasConfirmationDoc: Boolean(confirmationDoc) }),
    [entry, canSeeFinancials, confirmationDoc]
  );
  const slug = getCategorySlug(entry.category);
  const timeChip = entry.timeStart ? formatTimeHHMM(entry.timeStart) : entry.duration || '';
  const isEditing = editingCardId === entry.id;

  const bookingSiteOptions = React.useMemo(
    () => bookingPartnerSearchUrls(entry.title || entry.location || 'hotel', entry.dateStart, entry.dateEnd),
    [entry.dateStart, entry.dateEnd, entry.location, entry.title]
  );

  const actions = React.useMemo(() => {
    type ActionItem = {
      label: string;
      href?: string;
      onClick?: () => void;
      primary?: boolean;
      primaryRust?: boolean;
      disabled?: boolean;
    };
    const rows: ActionItem[] = [];
    if (entry.category === 'Accommodation') {
      if (booked) {
        rows.push({
          label: 'Open booking',
          href: confirmationDoc?.fileUrl,
          primary: true,
          disabled: !confirmationDoc?.fileUrl
        });
      } else {
        rows.push({ label: 'Book now', onClick: () => setShowBookingSites(true), primary: true, primaryRust: true });
      }
      if (mapsDirectionsUrl) rows.push({ label: 'Directions', href: mapsDirectionsUrl });
      if (entry.phoneNumber) rows.push({ label: 'Call', href: `tel:${entry.phoneNumber}` });
    } else if (entry.category === 'Flights') {
      if (confirmationDoc?.fileUrl) rows.push({ label: 'Boarding pass', href: confirmationDoc.fileUrl, primary: true });
      if (mapsDirectionsUrl) rows.push({ label: 'Directions', href: mapsDirectionsUrl });
      if (entryLinks[0]?.url) rows.push({ label: 'Airline site', href: entryLinks[0].url });
    } else if (entry.category === 'Transport') {
      if (entryLinks[0]?.url) rows.push({ label: 'Timetable', href: entryLinks[0].url });
      if (mapsPlaceUrl) rows.push({ label: 'Map', href: mapsPlaceUrl });
      if (mapsDirectionsUrl) rows.push({ label: 'Directions', href: mapsDirectionsUrl });
    } else if (entry.category === 'Cruise' || entry.category === 'Cruise port') {
      if (confirmationDoc?.fileUrl) rows.push({ label: 'Boarding pass', href: confirmationDoc.fileUrl });
      if (entryLinks[0]?.url) rows.push({ label: 'Deck map', href: entryLinks[0].url });
      if (mapsPlaceUrl) rows.push({ label: 'Port map', href: mapsPlaceUrl });
      if (mapsDirectionsUrl) rows.push({ label: 'Directions', href: mapsDirectionsUrl });
    } else if (entry.category === 'Food & Dining' || entry.category === 'Dining') {
      if (entryDocs[0]?.fileUrl) rows.push({ label: 'Open document', href: entryDocs[0].fileUrl });
      if (entryLinks[0]?.url) rows.push({ label: 'View details', href: entryLinks[0].url });
    } else {
      if (!booked) rows.push({ label: 'Book now', onClick: () => setShowBookingSites(true), primary: true });
      else if (confirmationDoc?.fileUrl) rows.push({ label: 'Open booking', href: confirmationDoc.fileUrl, primary: true });
      if (mapsPlaceUrl) rows.push({ label: 'View on map', href: mapsPlaceUrl });
      if (mapsDirectionsUrl) rows.push({ label: 'Directions', href: mapsDirectionsUrl });
      if (entryLinks[0]?.url) rows.push({ label: 'Website', href: entryLinks[0].url });
    }
    return rows.slice(0, 4);
  }, [booked, confirmationDoc, entry, entryDocs, entryLinks, mapsDirectionsUrl, mapsPlaceUrl]);

  if (isEditing) {
    return ReactDOM.createPortal(
      <div className={cardStyles.portalEditRoot} role="presentation">
        <div className={cardStyles.portalEditInner}>
          <ItineraryCardEdit
            key={entry.id}
            entry={entry}
            calendarDate={calendarDate}
            onSave={(saved) => {
              updateEntry(saved);
              setEditingCardId(null);
            }}
            onCancel={() => setEditingCardId(null)}
            onDelete={() => {
              setEditingCardId(null);
              onClose();
            }}
          />
        </div>
      </div>,
      document.body
    );
  }

  return (
    <div className={styles.page}>
      <header className={styles.topBar}>
        <button type="button" className={styles.back} onClick={onClose}>
          ← Back
        </button>
        {trip?.title ? <p className={styles.tripTitle}>{trip.title}</p> : <span />}
        {canEditItinerary ? (
          <button type="button" className={styles.editBtn} onClick={() => setEditingCardId(entry.id)}>
            Edit
          </button>
        ) : (
          <span />
        )}
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
            {entry.duration ? <span className={styles.flightDur}>{entry.duration}</span> : null}
          </div>
          <div>
            <p className={styles.flightLabel}>Arrives</p>
            <p className={styles.flightTime}>{entry.arrivalTime ? formatTimeHHMM(entry.arrivalTime) : '—'}</p>
            <p className={styles.flightPlace}>{entry.transportTo || '—'}</p>
          </div>
        </div>
      ) : null}

      {stats.length ? (
        <div className={styles.statsBar}>
          {stats.map((s) => (
            <div key={s.label} className={styles.statItem}>
              <span className={styles.statLabel}>{s.label}</span>
              <span className={styles.statValue}>{s.value}</span>
            </div>
          ))}
        </div>
      ) : null}

      {sections.map((section) => (
        <section key={section.id} className={styles.sectionCard}>
          <div className={styles.sectionHead}>
            <h3 className={styles.sectionTitle}>{section.title}</h3>
            {section.statusPill ? (
              <span className={`${styles.statusPill} ${pillToneClass(section.statusPill.tone)}`}>{section.statusPill.label}</span>
            ) : null}
          </div>
          {section.fields ? (
            <div className={styles.fieldGrid}>
              {section.fields.map((f) => (
                <div key={f.label} className={styles.fieldItem}>
                  <span className={styles.fieldLabel}>{f.label}</span>
                  <span className={`${styles.fieldValue} ${f.highlight ? styles.fieldHighlight : ''}`}>{f.value}</span>
                </div>
              ))}
            </div>
          ) : null}
        </section>
      ))}

      {entry.notes && !isLocationInfo && hasNotes ? (
        <section className={styles.sectionCard}>
          <h3 className={styles.sectionTitle}>Notes</h3>
          <div className={styles.notesBox}>
            <RichTextContent html={entry.notes} />
          </div>
        </section>
      ) : null}

      {isLocationInfo ? <SharedLocationInfoBlock entry={entry} /> : null}

      {actions.length ? (
        <div className={styles.actions}>
          {actions.map((a) => {
            const className = `${styles.actionBtn} ${a.primary ? (a.primaryRust ? styles.actionRust : styles.actionPrimary) : ''} ${a.disabled ? styles.actionDisabled : ''}`;
            if (a.href && !a.disabled) {
              return (
                <a key={a.label} className={className} href={a.href} target="_blank" rel="noopener noreferrer">
                  {a.label}
                </a>
              );
            }
            if (a.onClick && !a.disabled) {
              return (
                <button key={a.label} type="button" className={className} onClick={a.onClick}>
                  {a.label}
                </button>
              );
            }
            return (
              <span key={a.label} className={className} aria-disabled="true">
                {a.label}
              </span>
            );
          })}
        </div>
      ) : null}

      {entryDocs.length ? (
        <section className={styles.sectionCard}>
          <h3 className={styles.sectionTitle}>Documents</h3>
          {entryDocs.map((d) => (
            <a key={d.id} className={styles.docRow} href={d.fileUrl} target="_blank" rel="noopener noreferrer">
              <span>{d.title || d.fileName || 'Document'}</span>
              <span aria-hidden>›</span>
            </a>
          ))}
        </section>
      ) : null}

      {entryLinks.length ? (
        <section className={styles.sectionCard}>
          <h3 className={styles.sectionTitle}>Links</h3>
          {entryLinks.map((l) => (
            <a key={l.id} className={styles.docRow} href={l.url} target="_blank" rel="noopener noreferrer">
              <span>{l.linkTitle || l.title || l.url}</span>
              <span aria-hidden>›</span>
            </a>
          ))}
        </section>
      ) : null}

      {showBookingSites ? (
        <MobileBookingSiteSheet
          title={entry.title || entry.location || 'Booking'}
          options={bookingSiteOptions}
          onClose={() => setShowBookingSites(false)}
        />
      ) : null}
    </div>
  );
};
