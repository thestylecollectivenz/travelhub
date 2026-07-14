import * as React from 'react';
import type { ItineraryEntry } from '../../models/ItineraryEntry';
import type { EntryDocument } from '../../models/EntryDocument';
import type { EntryLink } from '../../models/EntryLink';
import { CategoryIcon } from '../shared/CategoryIcon';
import { getCategorySlug } from '../../utils/categoryUtils';
import { formatDisplayLabel } from '../../utils/mobileDisplayFormat';
import { buildAccommodationDocLinkPills } from '../../utils/mobileAccommodationDetail';
import {
  buildTransportDetailData,
  findTransportTimetableHref
} from '../../utils/mobileTransportDetail';
import { effectiveBookingStatus, findConfirmationDocument } from '../../utils/bookingStatusUtils';
import { isRichTextEditorEmpty } from '../../utils/journalRichText';
import { RichTextContent } from '../shared/RichTextContent';
import { MobilePencilButton } from './MobilePencilButton';
import { MobileDetailAiPanel } from './MobileDetailAiPanel';
import { openMobileExternalUrl } from '../../hooks/useMobileDetailHistory';
import { useShellMode } from '../../hooks/useShellMode';
import { useTripWorkspace } from '../../context/TripWorkspaceContext';
import { useConfig } from '../../context/ConfigContext';
import styles from './MobileTransportDetail.module.css';

export interface MobileTransportDetailProps {
  entry: ItineraryEntry;
  calendarDate: string;
  documents: EntryDocument[];
  links: EntryLink[];
  canSeeFinancials: boolean;
  canEdit: boolean;
  onEdit: () => void;
  mapsDirectionsUrl?: string;
  mapsPlaceUrl?: string;
}

function chipIcon(kind: 'star' | 'dot'): React.ReactNode {
  if (kind === 'star') {
    return (
      <svg width="10" height="10" viewBox="0 0 12 12" fill="none" aria-hidden>
        <path d="M6 1.2 7.4 4.6l3.6.3-2.7 2.3.8 3.5L6 9.1 3 10.7l.8-3.5L1 4.9l3.6-.3L6 1.2Z" fill="currentColor" />
      </svg>
    );
  }
  return <span className={styles.statusDot} aria-hidden />;
}

function tabIcon(kind: 'timetable' | 'map' | 'directions' | 'info', size = 18): React.ReactNode {
  if (kind === 'timetable') {
    return (
      <svg width={size} height={size} viewBox="0 0 20 20" fill="none" aria-hidden>
        <rect x="3" y="5" width="14" height="12" rx="1.5" stroke="currentColor" strokeWidth="1.3" />
        <path d="M7 3v2M13 3v2M3 9h14" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" />
      </svg>
    );
  }
  if (kind === 'map') {
    return (
      <svg width={size} height={size} viewBox="0 0 20 20" fill="none" aria-hidden>
        <path d="M10 3C7.24 3 5 5.24 5 8c0 4.25 5 9 5 9s5-4.75 5-9c0-2.76-2.24-5-5-5z" stroke="currentColor" strokeWidth="1.3" />
        <circle cx="10" cy="8" r="1.8" stroke="currentColor" strokeWidth="1.2" />
      </svg>
    );
  }
  if (kind === 'directions') {
    return (
      <svg width={size} height={size} viewBox="0 0 20 20" fill="none" aria-hidden>
        <path d="M6 4 14 10 6 16V4Z" stroke="currentColor" strokeWidth="1.4" strokeLinejoin="round" />
      </svg>
    );
  }
  return (
    <svg width={size} height={size} viewBox="0 0 20 20" fill="none" aria-hidden>
      <rect x="3" y="4" width="14" height="12" rx="1.2" stroke="currentColor" strokeWidth="1.3" />
      <path d="M7 8h6M7 11h4" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" />
    </svg>
  );
}

function sectionIcon(kind: 'wallet' | 'docs' | 'notes', size = 14): React.ReactNode {
  if (kind === 'wallet') {
    return (
      <svg width={size} height={size} viewBox="0 0 16 16" fill="none" aria-hidden>
        <rect x="2" y="4" width="12" height="9" rx="1.5" stroke="currentColor" strokeWidth="1.2" />
        <path d="M2 7h12" stroke="currentColor" strokeWidth="1.2" />
      </svg>
    );
  }
  if (kind === 'docs') {
    return (
      <svg width={size} height={size} viewBox="0 0 16 16" fill="none" aria-hidden>
        <path d="M5.5 2.5h5l2.5 2.5V13a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V3.5a1 1 0 0 1 1-1h1.5Z" stroke="currentColor" strokeWidth="1.2" />
      </svg>
    );
  }
  return (
    <svg width={size} height={size} viewBox="0 0 16 16" fill="none" aria-hidden>
      <rect x="3" y="2.5" width="10" height="11" rx="1.2" stroke="currentColor" strokeWidth="1.2" />
      <path d="M5.5 6h5M5.5 8.5h3.5" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" />
    </svg>
  );
}

function Field({
  label,
  value,
  pill
}: {
  label: string;
  value?: string;
  pill?: { label: string; tone: 'green' | 'rust' | 'red' | 'neutral' };
}): React.ReactElement {
  return (
    <div className={styles.bpField}>
      <span className={styles.gridLabel}>{label}</span>
      {pill ? (
        <span className={`${styles.inlinePill} ${styles[`pill_${pill.tone}`]}`}>{pill.label}</span>
      ) : (
        <span className={styles.gridValue}>{value || '—'}</span>
      )}
    </div>
  );
}

export const MobileTransportDetail: React.FC<MobileTransportDetailProps> = ({
  entry,
  calendarDate,
  documents,
  links,
  canSeeFinancials,
  canEdit,
  onEdit,
  mapsDirectionsUrl,
  mapsPlaceUrl
}) => {
  const shellMode = useShellMode();
  const isIpad = shellMode === 'ipad-portrait';
  const iconTab = isIpad ? 26 : 18;
  const iconSec = isIpad ? 18 : 14;
  const journeyRef = React.useRef<HTMLElement>(null);
  const { convertToHomeCurrency, tripDays } = useTripWorkspace();
  const { config } = useConfig();
  const confirmationDoc = findConfirmationDocument(documents);
  const booked = effectiveBookingStatus(entry, { hasConfirmationDoc: Boolean(confirmationDoc) });
  const slug = getCategorySlug(entry.category);
  const hasNotes = !isRichTextEditorEmpty(entry.notes);
  const timetableHref = findTransportTimetableHref(documents, links);

  const data = React.useMemo(
    () =>
      buildTransportDetailData(entry, calendarDate, {
        canSeeFinancials,
        hasConfirmationDoc: Boolean(confirmationDoc),
        tripDays,
        convertToHomeCurrency,
        homeCurrency: config.homeCurrency || 'NZD'
      }),
    [entry, calendarDate, canSeeFinancials, confirmationDoc, tripDays, convertToHomeCurrency, config.homeCurrency]
  );

  const bp = data.bookingPayment;
  const docLinkPills = React.useMemo(() => buildAccommodationDocLinkPills(documents, links), [documents, links]);

  const scrollToJourney = (): void => {
    journeyRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };

  const openUrl = (url: string, e?: React.MouseEvent): void => openMobileExternalUrl(url, e);

  const actionTabs = (
    <div className={styles.actionGrid}>
      {timetableHref ? (
        <a
          className={`${styles.actionTile} ${styles.actionPrimary}`}
          href={timetableHref}
          target="_blank"
          rel="noopener noreferrer"
          onClick={(e) => openUrl(timetableHref, e)}
        >
          {tabIcon('timetable', iconTab)}
          <span>Timetable</span>
        </a>
      ) : (
        <span className={`${styles.actionTile} ${styles.actionWash}`} aria-disabled="true">
          {tabIcon('timetable', iconTab)}
          <span>Timetable</span>
        </span>
      )}
      {mapsPlaceUrl ? (
        <a
          className={`${styles.actionTile} ${styles.actionWash}`}
          href={mapsPlaceUrl}
          target="_blank"
          rel="noopener noreferrer"
          onClick={(e) => openUrl(mapsPlaceUrl, e)}
        >
          {tabIcon('map', iconTab)}
          <span>Map</span>
        </a>
      ) : (
        <span className={`${styles.actionTile} ${styles.actionWash}`} aria-disabled="true">
          {tabIcon('map', iconTab)}
          <span>Map</span>
        </span>
      )}
      {mapsDirectionsUrl ? (
        <a
          className={`${styles.actionTile} ${styles.actionWash}`}
          href={mapsDirectionsUrl}
          target="_blank"
          rel="noopener noreferrer"
          onClick={(e) => openUrl(mapsDirectionsUrl, e)}
        >
          {tabIcon('directions', iconTab)}
          <span>Directions</span>
        </a>
      ) : (
        <span className={`${styles.actionTile} ${styles.actionWash}`} aria-disabled="true">
          {tabIcon('directions', iconTab)}
          <span>Directions</span>
        </span>
      )}
      <button type="button" className={`${styles.actionTile} ${styles.actionWash}`} onClick={scrollToJourney}>
        {tabIcon('info', iconTab)}
        <span>Transport info</span>
      </button>
    </div>
  );

  const bookingSection = (
    <section className={styles.sectionCard}>
      <div className={styles.sectionHead}>
        <span className={styles.sectionIcon}>{sectionIcon('wallet', iconSec)}</span>
        <h2 className={styles.sectionTitle}>Booking &amp; payment</h2>
      </div>
      <div className={styles.bpGrid}>
        <Field label="Booking reference" value={bp.bookingReference} />
        <Field label="Booking status" pill={bp.bookingStatus} />
        <Field label="Supplier" value={bp.supplier} />
        <Field label="Transport mode" value={entry.transportMode || '—'} />
      </div>
      {bp.showPayment ? (
        <>
          <div className={styles.rowDivider} />
          <h3 className={styles.paymentSubhead}>Payment details</h3>
          <div className={styles.bpGrid}>
            <Field label="Payment due" value={bp.paymentDue} />
            {bp.paymentStatus ? <Field label="Payment status" pill={bp.paymentStatus} /> : <span />}
          </div>
          {bp.amountPrimary ? (
            <div className={styles.amountBlock}>
              <span className={styles.gridLabel}>Amount</span>
              <div className={styles.amountCols}>
                <span className={styles.amountPrimary}>{bp.amountPrimary}</span>
                {bp.amountHome ? <span className={styles.amountHome}>{bp.amountHome}</span> : null}
              </div>
            </div>
          ) : null}
        </>
      ) : null}
    </section>
  );

  const docsSection = (
    <section className={styles.sectionCard}>
      <div className={styles.sectionHead}>
        <span className={styles.sectionIcon}>{sectionIcon('docs', iconSec)}</span>
        <h2 className={styles.sectionTitle}>Documents &amp; links</h2>
      </div>
      {docLinkPills.length ? (
        <div className={styles.docList}>
          {docLinkPills.map((p) => (
            <a
              key={p.id}
              className={styles.docRow}
              href={p.href}
              target="_blank"
              rel="noopener noreferrer"
              onClick={(e) => openUrl(p.href, e)}
            >
              <span className={styles.docRowIcon} aria-hidden>
                {p.kind === 'document' ? (
                  <svg width="14" height="14" viewBox="0 0 12 12" fill="none">
                    <rect x="2" y="1.5" width="8" height="9" rx="1" stroke="currentColor" strokeWidth="1" />
                    <path d="M4 4h4M4 6h3" stroke="currentColor" strokeWidth="0.9" strokeLinecap="round" />
                  </svg>
                ) : (
                  <svg width="14" height="14" viewBox="0 0 12 12" fill="none">
                    <path d="M5 3.5h3.5V7M8.5 3.5 3.5 8.5" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" />
                  </svg>
                )}
              </span>
              <span className={styles.docRowLabel}>{p.label}</span>
              <span className={styles.docRowChevron} aria-hidden>
                {p.kind === 'link' ? '↗' : '›'}
              </span>
            </a>
          ))}
        </div>
      ) : (
        <p className={styles.emptyHint}>No documents or links yet.</p>
      )}
    </section>
  );

  const notesSection = (
    <section className={styles.sectionCard}>
      <div className={styles.sectionHead}>
        <span className={styles.sectionIcon}>{sectionIcon('notes', iconSec)}</span>
        <h2 className={styles.sectionTitle}>Notes</h2>
      </div>
      {hasNotes ? (
        <div className={styles.notesBody}>
          <RichTextContent html={entry.notes} />
        </div>
      ) : (
        <p className={styles.emptyHint}>No notes yet.</p>
      )}
    </section>
  );

  return (
    <div className={styles.root} data-shell={isIpad ? 'ipad-portrait' : undefined}>
      <section className={styles.summaryCard}>
        <div className={styles.summaryLeft}>
          <span className={styles.summaryDate}>{data.summaryDate}</span>
          <span className={styles.summaryTime}>{data.summaryTime}</span>
        </div>
        <div className={styles.summaryCenter}>
          <span className={`${styles.summaryCatIcon} th-cat-${slug}`} aria-hidden>
            <CategoryIcon category={entry.category} size={isIpad ? 22 : 18} color="white" />
          </span>
          <p className={styles.summaryRoute}>
            {data.routeFrom} → {data.routeTo}
          </p>
          <p className={styles.summaryMode}>{data.modeSubtitle}</p>
          <div className={styles.summaryPills}>
            <span className={`${styles.chip} ${styles.chipCat} th-cat-${slug}`}>
              {chipIcon('star')}
              {entry.category}
            </span>
            <span className={`${styles.chip} ${styles.chipStatus}`}>
              {chipIcon('dot')}
              {formatDisplayLabel(entry.decisionStatus)}
            </span>
            {booked ? (
              <span className={`${styles.chip} ${styles.chipBooked}`}>Booked</span>
            ) : null}
          </div>
          <p className={styles.summaryLocation}>
            <svg width="11" height="11" viewBox="0 0 12 14" fill="none" aria-hidden>
              <path d="M6 1C3.79 1 2 2.79 2 5c0 3 4 8 4 8s4-5 4-8c0-2.21-1.79-4-4-4z" fill="currentColor" />
            </svg>
            {data.locationLine}
          </p>
        </div>
        <div className={styles.summaryRight}>
          {canEdit ? <MobilePencilButton onClick={onEdit} ariaLabel="Edit transport" /> : null}
        </div>
      </section>

      {actionTabs}

      <section className={styles.sectionCard} id="journey-details" ref={journeyRef}>
        <div className={styles.sectionHead}>
          <h2 className={styles.sectionTitle}>Journey details</h2>
        </div>
        <div className={styles.journeyGrid}>
          {data.journeyRows.map((row) => (
            <div key={row.label} className={styles.journeyCell}>
              <span className={styles.gridLabel}>{row.label}</span>
              <span className={styles.gridValue}>{row.value}</span>
            </div>
          ))}
        </div>
        <div className={styles.infoCallout}>
          <span className={styles.infoCalloutIcon} aria-hidden>
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
              <circle cx="8" cy="8" r="6.5" stroke="currentColor" strokeWidth="1.2" />
              <path d="M8 7v4M8 5.2h.01" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
            </svg>
          </span>
          <p>{data.luggageNote}</p>
        </div>
      </section>

      <div className={styles.detailColumns}>
        <div className={styles.detailCol}>{bookingSection}</div>
        <div className={styles.detailCol}>
          {notesSection}
          {docsSection}
        </div>
      </div>

      <MobileDetailAiPanel entry={entry} hint="Transport schedules, connections, and luggage." />
    </div>
  );
};
