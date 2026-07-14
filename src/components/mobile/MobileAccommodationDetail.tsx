import * as React from 'react';
import type { ItineraryEntry } from '../../models/ItineraryEntry';
import type { EntryDocument } from '../../models/EntryDocument';
import type { EntryLink } from '../../models/EntryLink';
import { CategoryIcon } from '../shared/CategoryIcon';
import { getCategorySlug } from '../../utils/categoryUtils';
import { formatDisplayLabel } from '../../utils/mobileDisplayFormat';
import {
  buildAccommodationDetailData,
  buildAccommodationDocLinkPills,
  type AccomGridCell
} from '../../utils/mobileAccommodationDetail';
import { formatTimeHHMM } from '../../utils/itineraryTimeUtils';
import { effectiveBookingStatus, findConfirmationDocument } from '../../utils/bookingStatusUtils';
import { isRichTextEditorEmpty } from '../../utils/journalRichText';
import { RichTextContent } from '../shared/RichTextContent';
import { resolveStayHeroImageUrl, stayHeroPlaceholderUrl } from '../../utils/stayTileHeroImage';
import { useShellMode } from '../../hooks/useShellMode';
import { MobilePencilButton } from './MobilePencilButton';
import { MobileDetailAiPanel } from './MobileDetailAiPanel';
import { openMobileExternalUrl } from '../../hooks/useMobileDetailHistory';
import styles from './MobileAccommodationDetail.module.css';

export interface MobileAccommodationDetailProps {
  entry: ItineraryEntry;
  documents: EntryDocument[];
  links: EntryLink[];
  canSeeFinancials: boolean;
  canEdit: boolean;
  onEdit: () => void;
  onBookNow: () => void;
  onOpenPlannedActivity?: (subItemId: string) => void;
  mapsDirectionsUrl?: string;
  phoneNumber?: string;
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

function actionIcon(kind: 'booking' | 'directions' | 'call' | 'room'): React.ReactNode {
  if (kind === 'booking') {
    return (
      <svg width="18" height="18" viewBox="0 0 20 20" fill="none" aria-hidden>
        <rect x="3" y="5" width="14" height="12" rx="1.5" stroke="currentColor" strokeWidth="1.3" />
        <path d="M7 3v2M13 3v2M3 9h14" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" />
      </svg>
    );
  }
  if (kind === 'directions') {
    return (
      <svg width="18" height="18" viewBox="0 0 20 20" fill="none" aria-hidden>
        <path d="M6 4 14 10 6 16V4Z" stroke="currentColor" strokeWidth="1.4" strokeLinejoin="round" />
      </svg>
    );
  }
  if (kind === 'call') {
    return (
      <svg width="18" height="18" viewBox="0 0 20 20" fill="none" aria-hidden>
        <path
          d="M5.5 4h2.5l1.2 2.8-1.6 1.1c.9 1.7 2.3 3.1 4 4l1.1-1.6 2.8 1.2v2.5c0 .6-.5 1.1-1.1 1.1-5.2-.4-9.3-4.5-9.7-9.7 0-.6.5-1.1 1.1-1.1Z"
          stroke="currentColor"
          strokeWidth="1.3"
          strokeLinejoin="round"
        />
      </svg>
    );
  }
  return (
    <svg width="18" height="18" viewBox="0 0 20 20" fill="none" aria-hidden>
      <path d="M4 9h12v8H4V9Z" stroke="currentColor" strokeWidth="1.3" />
      <path d="M7 9V6a3 3 0 0 1 6 0v3" stroke="currentColor" strokeWidth="1.3" />
    </svg>
  );
}

function sectionIcon(kind: 'wallet' | 'bed' | 'docs' | 'notes'): React.ReactNode {
  if (kind === 'wallet') {
    return (
      <svg width="14" height="14" viewBox="0 0 16 16" fill="none" aria-hidden>
        <rect x="2" y="4" width="12" height="9" rx="1.5" stroke="currentColor" strokeWidth="1.2" />
        <path d="M2 7h12" stroke="currentColor" strokeWidth="1.2" />
        <circle cx="11.5" cy="9.5" r="1" fill="currentColor" />
      </svg>
    );
  }
  if (kind === 'bed') {
    return (
      <svg width="14" height="14" viewBox="0 0 16 16" fill="none" aria-hidden>
        <path d="M2 10V8a2.5 2.5 0 0 1 5 0v2M9 8a2.5 2.5 0 0 1 5 0v2" stroke="currentColor" strokeWidth="1.2" />
        <path d="M2 12h12v2H2v-2Z" fill="currentColor" opacity="0.35" />
      </svg>
    );
  }
  if (kind === 'docs') {
    return (
      <svg width="14" height="14" viewBox="0 0 16 16" fill="none" aria-hidden>
        <path d="M5.5 2.5h5l2.5 2.5V13a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V3.5a1 1 0 0 1 1-1h1.5Z" stroke="currentColor" strokeWidth="1.2" />
        <path d="M10 2.5V5h2.5" stroke="currentColor" strokeWidth="1.2" />
      </svg>
    );
  }
  return (
    <svg width="14" height="14" viewBox="0 0 16 16" fill="none" aria-hidden>
      <rect x="3" y="2.5" width="10" height="11" rx="1.2" stroke="currentColor" strokeWidth="1.2" />
      <path d="M5.5 6h5M5.5 8.5h3.5" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" />
    </svg>
  );
}

function GridCell({ cell: c }: { cell: AccomGridCell }): React.ReactElement {
  return (
    <div className={styles.gridCell}>
      <span className={styles.gridLabel}>{c.label}</span>
      {c.pill ? (
        <span className={`${styles.inlinePill} ${styles[`pill_${c.pill.tone}`]}`}>{c.pill.label}</span>
      ) : (
        <span className={styles.gridValue}>{c.value}</span>
      )}
    </div>
  );
}

function GridRow({ cells, bordered }: { cells: AccomGridCell[]; bordered?: boolean }): React.ReactElement | null {
  if (!cells.length) return null;
  return (
    <div className={`${styles.gridRow} ${bordered ? styles.gridRowBordered : ''}`}>
      {cells.map((c) => (
        <GridCell key={c.label} cell={c} />
      ))}
    </div>
  );
}

export const MobileAccommodationDetail: React.FC<MobileAccommodationDetailProps> = ({
  entry,
  documents,
  links,
  canSeeFinancials,
  canEdit,
  onEdit,
  onBookNow,
  onOpenPlannedActivity,
  mapsDirectionsUrl,
  phoneNumber
}) => {
  const shellMode = useShellMode();
  const stayRef = React.useRef<HTMLElement>(null);
  const confirmationDoc = findConfirmationDocument(documents);
  const booked = effectiveBookingStatus(entry, { hasConfirmationDoc: Boolean(confirmationDoc) });
  const slug = getCategorySlug(entry.category);
  const locationLabel = (entry.location ?? '').trim();
  const streetLabel = (entry.streetAddress ?? '').trim();
  const hasNotes = !isRichTextEditorEmpty(entry.notes);
  const [heroSrc, setHeroSrc] = React.useState(() =>
    stayHeroPlaceholderUrl(entry.title || 'Hotel', locationLabel || entry.location || '', 'accommodation')
  );

  const data = React.useMemo(
    () => buildAccommodationDetailData(entry, { canSeeFinancials, hasConfirmationDoc: Boolean(confirmationDoc) }),
    [entry, canSeeFinancials, confirmationDoc]
  );

  const docLinkPills = React.useMemo(() => buildAccommodationDocLinkPills(documents, links), [documents, links]);

  const bookingRow1 = data.bookingGrid.slice(0, 3);
  const bookingRow2 = data.bookingGrid.slice(3, 6);
  const extraRow = data.extraBookingGrid;

  React.useEffect(() => {
    let cancelled = false;
    void resolveStayHeroImageUrl(entry.title || 'Hotel', locationLabel || '', 'accommodation').then((url) => {
      if (!cancelled) setHeroSrc(url);
    });
    return () => {
      cancelled = true;
    };
  }, [entry.title, locationLabel]);

  const scrollToStay = (): void => {
    stayRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };

  const bookingSection =
    canSeeFinancials && (bookingRow1.length || bookingRow2.length) ? (
      <section className={styles.sectionCard}>
        <div className={styles.sectionHead}>
          <span className={styles.sectionIcon}>{sectionIcon('wallet')}</span>
          <h2 className={styles.sectionTitle}>Booking &amp; payment</h2>
        </div>
        <GridRow cells={bookingRow1} bordered />
        {bookingRow1.length && bookingRow2.length ? <div className={styles.rowDivider} /> : null}
        <GridRow cells={bookingRow2} bordered />
        {extraRow.length ? (
          <>
            <div className={styles.rowDivider} />
            <GridRow cells={extraRow} bordered />
          </>
        ) : null}
      </section>
    ) : !canSeeFinancials && (entry.bookingReference || entry.supplier) ? (
      <section className={styles.sectionCard}>
        <div className={styles.sectionHead}>
          <span className={styles.sectionIcon}>{sectionIcon('wallet')}</span>
          <h2 className={styles.sectionTitle}>Booking &amp; payment</h2>
        </div>
        <GridRow
          bordered
          cells={[
            ...(entry.bookingReference ? [{ label: 'Booking reference', value: entry.bookingReference }] : []),
            ...(entry.supplier ? [{ label: 'Supplier', value: entry.supplier }] : [])
          ]}
        />
      </section>
    ) : null;

  const staySection = (
    <section className={styles.sectionCard} id="stay-details" ref={stayRef}>
      <div className={styles.sectionHead}>
        <span className={styles.sectionIcon}>{sectionIcon('bed')}</span>
        <h2 className={styles.sectionTitle}>Stay details</h2>
      </div>
      <GridRow cells={data.stayGrid} bordered />
      {data.perks ? (
        <div className={styles.subDetailRow}>
          <span className={styles.perksIcon} aria-hidden>
            <svg width="14" height="14" viewBox="0 0 16 16" fill="none">
              <path
                d="M8 2.5 9.8 6.2 14 6.7l-3 2.6.9 3.9L8 11.2 4.1 13.2l.9-3.9-3-2.6 4.2-.5L8 2.5Z"
                stroke="currentColor"
                strokeWidth="1.1"
                strokeLinejoin="round"
              />
            </svg>
          </span>
          <div>
            <span className={styles.gridLabel}>Perks</span>
            <p className={styles.subDetailText}>{data.perks}</p>
          </div>
        </div>
      ) : null}
      {data.cancellation ? (
        <div className={styles.cancelBox}>
          <span className={styles.cancelIcon} aria-hidden>
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
              <path
                d="M8 1.5 2.5 3v5c0 3.5 2.8 5.8 5.5 6.5C10.7 13.8 13.5 11.5 13.5 8V3L8 1.5Z"
                stroke="currentColor"
                strokeWidth="1.2"
              />
              <path d="M5.5 8.2 7.2 10l3.3-3.8" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" />
            </svg>
          </span>
          <div>
            <span className={styles.gridLabel}>Cancellation</span>
            <p className={styles.subDetailText}>{data.cancellation}</p>
          </div>
        </div>
      ) : null}
    </section>
  );

  const docsSection = docLinkPills.length ? (
    <section className={styles.sectionCard}>
      <div className={styles.sectionHead}>
        <span className={styles.sectionIcon}>{sectionIcon('docs')}</span>
        <h2 className={styles.sectionTitle}>Documents &amp; links</h2>
      </div>
      <div className={styles.docList}>
        {docLinkPills.map((p) => (
          <a
            key={p.id}
            className={styles.docRow}
            href={p.href}
            target="_blank"
            rel="noopener noreferrer"
            onClick={(e) => openMobileExternalUrl(p.href, e)}
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
              ›
            </span>
          </a>
        ))}
      </div>
    </section>
  ) : null;

  const notesSection = hasNotes ? (
    <section className={styles.sectionCard}>
      <div className={styles.sectionHead}>
        <span className={styles.sectionIcon}>{sectionIcon('notes')}</span>
        <h2 className={styles.sectionTitle}>Notes</h2>
      </div>
      <div className={styles.notesBody}>
        <RichTextContent html={entry.notes} />
      </div>
    </section>
  ) : null;

  return (
    <div
      className={styles.root}
      data-shell={shellMode === 'ipad-portrait' ? 'ipad-portrait' : undefined}
    >
      <section className={styles.overviewCard}>
        <div className={styles.overviewMain}>
          <div className={styles.heroPhotoWrap}>
            <img className={styles.heroPhoto} src={heroSrc} alt="" />
            <span className={`${styles.heroPhotoBadge} th-cat-${slug}`} aria-hidden>
              <CategoryIcon category={entry.category} size={18} color="white" />
            </span>
          </div>
          <div className={styles.heroCopy}>
            <div className={styles.heroTitleRow}>
              <h1 className={styles.title}>{entry.title}</h1>
              {canEdit ? <MobilePencilButton onClick={onEdit} ariaLabel="Edit accommodation" /> : null}
            </div>
            <div className={styles.chips}>
              <span className={`${styles.chip} ${styles.chipCat} th-cat-${slug}`}>
                {chipIcon('star')}
                {entry.category}
              </span>
              <span className={`${styles.chip} ${styles.chipStatus}`}>
                {chipIcon('dot')}
                {formatDisplayLabel(entry.decisionStatus)}
              </span>
            </div>
            {locationLabel ? (
              <p className={styles.locationLine}>
                <svg width="11" height="11" viewBox="0 0 12 14" fill="none" aria-hidden>
                  <path d="M6 1C3.79 1 2 2.79 2 5c0 3 4 8 4 8s4-5 4-8c0-2.21-1.79-4-4-4z" fill="currentColor" />
                </svg>
                {locationLabel}
              </p>
            ) : null}
            {streetLabel && streetLabel !== locationLabel ? <p className={styles.streetLine}>{streetLabel}</p> : null}
          </div>
        </div>

        <div className={styles.actionGrid}>
          {booked ? (
            confirmationDoc?.fileUrl ? (
              <a
                className={`${styles.actionTile} ${styles.actionPrimary}`}
                href={confirmationDoc.fileUrl}
                target="_blank"
                rel="noopener noreferrer"
                onClick={(e) => openMobileExternalUrl(confirmationDoc.fileUrl, e)}
              >
                {actionIcon('booking')}
                <span>Open booking</span>
              </a>
            ) : (
              <span className={`${styles.actionTile} ${styles.actionOutline}`} aria-disabled="true">
                {actionIcon('booking')}
                <span>Open booking</span>
              </span>
            )
          ) : (
            <button type="button" className={`${styles.actionTile} ${styles.actionPrimary}`} onClick={onBookNow}>
              {actionIcon('booking')}
              <span>Book now</span>
            </button>
          )}
          {mapsDirectionsUrl ? (
            <a
              className={`${styles.actionTile} ${styles.actionOutline}`}
              href={mapsDirectionsUrl}
              target="_blank"
              rel="noopener noreferrer"
              onClick={(e) => openMobileExternalUrl(mapsDirectionsUrl, e)}
            >
              {actionIcon('directions')}
              <span>Directions</span>
            </a>
          ) : (
            <span className={`${styles.actionTile} ${styles.actionOutline}`} aria-disabled="true">
              {actionIcon('directions')}
              <span>Directions</span>
            </span>
          )}
          {phoneNumber ? (
            <a className={`${styles.actionTile} ${styles.actionOutline}`} href={`tel:${phoneNumber}`}>
              {actionIcon('call')}
              <span>Call</span>
            </a>
          ) : (
            <span className={`${styles.actionTile} ${styles.actionOutline}`} aria-disabled="true">
              {actionIcon('call')}
              <span>Call</span>
            </span>
          )}
          <button type="button" className={`${styles.actionTile} ${styles.actionOutline}`} onClick={scrollToStay}>
            {actionIcon('room')}
            <span>Room details</span>
          </button>
        </div>
      </section>

      {(data.nights > 0 || data.checkInDate || data.checkOutDate) && (
        <section className={styles.staySummary}>
          {data.nights > 0 ? (
            <div className={styles.summaryCol}>
              <span className={styles.summaryIcon} aria-hidden>
                <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
                  <path
                    d="M11.8 3.2a5.5 5.5 0 1 1-7.1 7.1A5.5 5.5 0 0 1 11.8 3.2Z"
                    stroke="currentColor"
                    strokeWidth="1.2"
                    strokeLinejoin="round"
                  />
                </svg>
              </span>
              <span className={styles.summaryValue}>
                {data.nights} night{data.nights === 1 ? '' : 's'}
              </span>
              <span className={styles.summaryLabel}>Length of stay</span>
            </div>
          ) : null}
          {data.checkInDate ? (
            <div className={styles.summaryCol}>
              <span className={styles.summaryIcon} aria-hidden>
                <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
                  <rect x="2.5" y="3.5" width="11" height="10" rx="1.2" stroke="currentColor" strokeWidth="1.2" />
                  <path d="M5.5 2v2M10.5 2v2M2.5 7h11" stroke="currentColor" strokeWidth="1.2" />
                </svg>
              </span>
              <span className={styles.summaryMetaLabel}>Check-in</span>
              <span className={styles.summaryValue}>{data.checkInTime || data.checkInDate}</span>
            </div>
          ) : null}
          {data.checkOutDate ? (
            <div className={styles.summaryCol}>
              <span className={styles.summaryIcon} aria-hidden>
                <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
                  <rect x="2.5" y="3.5" width="11" height="10" rx="1.2" stroke="currentColor" strokeWidth="1.2" />
                  <path d="M5.5 2v2M10.5 2v2M2.5 7h11" stroke="currentColor" strokeWidth="1.2" />
                </svg>
              </span>
              <span className={styles.summaryMetaLabel}>Check-out</span>
              <span className={styles.summaryValue}>{data.checkOutTime || data.checkOutDate}</span>
            </div>
          ) : null}
        </section>
      )}

      <div className={styles.detailColumns}>
        <div className={styles.detailCol}>
          {bookingSection}
          {docsSection}
        </div>
        <div className={styles.detailCol}>
          {staySection}
          {notesSection}
        </div>
      </div>

      {(entry.subItems ?? []).length > 0 ? (
        <section className={styles.sectionCard}>
          <div className={styles.sectionHead}>
            <h2 className={styles.sectionTitle}>Activities planned</h2>
          </div>
          <div className={styles.plannedList}>
            {(entry.subItems ?? []).map((sub) => (
              <button
                key={sub.id}
                type="button"
                className={styles.plannedRow}
                onClick={() => onOpenPlannedActivity?.(sub.id)}
              >
                <span className={styles.plannedTitle}>{sub.title}</span>
                <span className={styles.plannedMeta}>
                  {[sub.startTime ? formatTimeHHMM(sub.startTime) : '', sub.category || 'Activity']
                    .filter(Boolean)
                    .join(' · ')}
                </span>
                <span aria-hidden>›</span>
              </button>
            ))}
          </div>
        </section>
      ) : null}

      <MobileDetailAiPanel entry={entry} hint="Accommodation and stay logistics." />
    </div>
  );
};
