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
import {
  resolveStayHeroImageUrl,
  stayHeroPlaceholderUrl,
  stayHeroSearchTitle
} from '../../utils/stayTileHeroImage';
import { useShellMode } from '../../hooks/useShellMode';
import { useTripWorkspace } from '../../context/TripWorkspaceContext';
import { useConfig } from '../../context/ConfigContext';
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

function Field({
  label,
  value,
  sub,
  pill
}: {
  label: string;
  value?: string;
  sub?: string;
  pill?: { label: string; tone: 'green' | 'rust' | 'red' | 'neutral' };
}): React.ReactElement | null {
  if (!value && !pill) return null;
  return (
    <div className={styles.bpField}>
      <span className={styles.gridLabel}>{label}</span>
      {pill ? (
        <span className={`${styles.inlinePill} ${styles[`pill_${pill.tone}`]}`}>{pill.label}</span>
      ) : (
        <span className={styles.gridValue}>{value}</span>
      )}
      {sub ? <span className={styles.bpSub}>{sub}</span> : null}
    </div>
  );
}

function StayGridCell({ cell: c }: { cell: AccomGridCell }): React.ReactElement {
  return (
    <div className={styles.bpField}>
      <span className={styles.gridLabel}>{c.label}</span>
      <span className={styles.gridValue}>{c.value}</span>
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
  const { convertToHomeCurrency } = useTripWorkspace();
  const { config } = useConfig();
  const stayRef = React.useRef<HTMLElement>(null);
  const confirmationDoc = findConfirmationDocument(documents);
  const booked = effectiveBookingStatus(entry, { hasConfirmationDoc: Boolean(confirmationDoc) });
  const slug = getCategorySlug(entry.category);
  const locationLabel = (entry.location ?? '').trim();
  const streetLabel = (entry.streetAddress ?? '').trim();
  const hasNotes = !isRichTextEditorEmpty(entry.notes);
  const heroTitle = stayHeroSearchTitle(entry, 'accommodation');
  const [heroSrc, setHeroSrc] = React.useState(() =>
    stayHeroPlaceholderUrl(heroTitle, locationLabel, 'accommodation')
  );

  const data = React.useMemo(
    () =>
      buildAccommodationDetailData(entry, {
        canSeeFinancials,
        hasConfirmationDoc: Boolean(confirmationDoc),
        convertToHomeCurrency,
        homeCurrency: config.homeCurrency || 'NZD'
      }),
    [entry, canSeeFinancials, confirmationDoc, convertToHomeCurrency, config.homeCurrency]
  );

  const bp = data.bookingPayment;
  const docLinkPills = React.useMemo(() => buildAccommodationDocLinkPills(documents, links), [documents, links]);

  React.useEffect(() => {
    let cancelled = false;
    void resolveStayHeroImageUrl(heroTitle, locationLabel, 'accommodation').then((url) => {
      if (!cancelled) setHeroSrc(url);
    });
    return () => {
      cancelled = true;
    };
  }, [heroTitle, locationLabel]);

  const scrollToStay = (): void => {
    stayRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };

  const actions = (
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
  );

  const bookingSection = (
    <section className={styles.sectionCard}>
      <div className={styles.sectionHead}>
        <span className={styles.sectionIcon}>{sectionIcon('wallet')}</span>
        <h2 className={styles.sectionTitle}>Booking &amp; payment</h2>
      </div>
      <div className={styles.bpGrid}>
        <Field label="Booking reference" value={bp.bookingReference || '—'} />
        <Field label="Booking status" pill={bp.bookingStatus} />
        <Field label="Check-in" value={bp.checkInPrimary} sub={bp.checkInSub} />
        <Field label="Check-out" value={bp.checkOutPrimary} />
        <Field label="Length of stay" value={bp.lengthOfStay} />
        <Field label="Supplier" value={bp.supplier} />
      </div>
      {bp.showPayment ? (
        <>
          <div className={styles.rowDivider} />
          <h3 className={styles.paymentSubhead}>Payment details</h3>
          <div className={styles.bpGrid}>
            <Field label="Payment due" value={bp.paymentDue} />
            {bp.paymentStatus ? <Field label="Payment status" pill={bp.paymentStatus} /> : <span />}
          </div>
          {bp.amount ? (
            <div className={styles.amountBlock}>
              <span className={styles.gridLabel}>Amount</span>
              <div className={styles.amountCols}>
                <div>
                  <span className={styles.amountPrimary}>{bp.amount.primary}</span>
                  {bp.amount.primaryPerNight ? (
                    <span className={styles.amountPerNight}>{bp.amount.primaryPerNight}</span>
                  ) : null}
                </div>
                {bp.amount.homeApprox ? (
                  <div>
                    <span className={styles.amountHome}>{bp.amount.homeApprox}</span>
                    {bp.amount.homePerNight ? (
                      <span className={styles.amountPerNight}>{bp.amount.homePerNight}</span>
                    ) : null}
                  </div>
                ) : null}
              </div>
              {bp.amount.exchangeNote ? (
                <p className={styles.exchangeNote}>
                  {bp.amount.exchangeNote}
                  <span className={styles.infoDot} aria-hidden>
                    i
                  </span>
                </p>
              ) : null}
            </div>
          ) : null}
        </>
      ) : null}
    </section>
  );

  const staySection = (
    <section className={styles.sectionCard} id="stay-details" ref={stayRef}>
      <div className={styles.sectionHead}>
        <span className={styles.sectionIcon}>{sectionIcon('bed')}</span>
        <h2 className={styles.sectionTitle}>Stay details</h2>
      </div>
      <div className={`${styles.bpGrid} ${styles.stayGrid}`}>
        {data.stayGrid.map((c) => (
          <StayGridCell key={c.label} cell={c} />
        ))}
      </div>
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

  const docsSection = (
    <section className={styles.sectionCard}>
      <div className={styles.sectionHead}>
        <span className={styles.sectionIcon}>{sectionIcon('docs')}</span>
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
              {p.kind === 'link' ? (
                <span className={styles.docRowChevron} aria-hidden>
                  ↗
                </span>
              ) : (
                <span className={styles.docRowChevron} aria-hidden>
                  ›
                </span>
              )}
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
        <span className={styles.sectionIcon}>{sectionIcon('notes')}</span>
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
    <div className={styles.root} data-shell={shellMode === 'ipad-portrait' ? 'ipad-portrait' : undefined}>
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
            {actions}
          </div>
        </div>
      </section>

      {(data.nights > 0 || data.checkInPrimary || data.checkOutPrimary) && (
        <section className={styles.staySummary}>
          {data.nights > 0 ? (
            <div className={styles.summaryCol}>
              <span className={styles.summaryIcon} aria-hidden>
                <svg width="18" height="18" viewBox="0 0 16 16" fill="none">
                  <path
                    d="M11.8 3.2a5.5 5.5 0 1 1-7.1 7.1A5.5 5.5 0 0 1 11.8 3.2Z"
                    stroke="currentColor"
                    strokeWidth="1.2"
                    strokeLinejoin="round"
                  />
                </svg>
              </span>
              <span className={styles.summaryMetaLabel}>Length of stay</span>
              <span className={styles.summaryValue}>
                {data.nights} night{data.nights === 1 ? '' : 's'}
              </span>
            </div>
          ) : null}
          {data.checkInPrimary ? (
            <div className={styles.summaryCol}>
              <span className={styles.summaryIcon} aria-hidden>
                <svg width="18" height="18" viewBox="0 0 16 16" fill="none">
                  <rect x="2.5" y="3.5" width="11" height="10" rx="1.2" stroke="currentColor" strokeWidth="1.2" />
                  <path d="M5.5 2v2M10.5 2v2M2.5 7h11" stroke="currentColor" strokeWidth="1.2" />
                </svg>
              </span>
              <span className={styles.summaryMetaLabel}>Check-in</span>
              <span className={styles.summaryValue}>Arrive {data.checkInPrimary}</span>
              {data.checkInSub ? <span className={styles.summarySub}>{data.checkInSub}</span> : null}
            </div>
          ) : null}
          {data.checkOutPrimary ? (
            <div className={styles.summaryCol}>
              <span className={styles.summaryIcon} aria-hidden>
                <svg width="18" height="18" viewBox="0 0 16 16" fill="none">
                  <rect x="2.5" y="3.5" width="11" height="10" rx="1.2" stroke="currentColor" strokeWidth="1.2" />
                  <path d="M5.5 2v2M10.5 2v2M2.5 7h11" stroke="currentColor" strokeWidth="1.2" />
                </svg>
              </span>
              <span className={styles.summaryMetaLabel}>Check-out</span>
              <span className={styles.summaryValue}>Depart {data.checkOutPrimary}</span>
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
