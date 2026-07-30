import * as React from 'react';
import type { ItineraryEntry } from '../../models/ItineraryEntry';
import type { EntryDocument } from '../../models/EntryDocument';
import type { EntryLink } from '../../models/EntryLink';
import { CategoryIcon } from '../shared/CategoryIcon';
import { getCategorySlug } from '../../utils/categoryUtils';
import { formatDisplayLabel } from '../../utils/mobileDisplayFormat';
import { buildAccommodationDocLinkPills } from '../../utils/mobileAccommodationDetail';
import { buildFlightDetailData, findFlightAirlineHref, findFlightBoardingPassHref } from '../../utils/mobileFlightDetail';
import { findConfirmationDocument } from '../../utils/bookingStatusUtils';
import { isRichTextEditorEmpty } from '../../utils/journalRichText';
import { RichTextContent } from '../shared/RichTextContent';
import { MobilePencilButton } from './MobilePencilButton';
import { MobileDetailAiPanel } from './MobileDetailAiPanel';
import { openMobileExternalUrl } from '../../hooks/useMobileDetailHistory';
import { useShellMode } from '../../hooks/useShellMode';
import { useTripWorkspace } from '../../context/TripWorkspaceContext';
import { useConfig } from '../../context/ConfigContext';
import styles from './MobileTransportDetail.module.css';
import flightStyles from './MobileFlightDetail.module.css';

export interface MobileFlightDetailProps {
  entry: ItineraryEntry;
  calendarDate: string;
  documents: EntryDocument[];
  links: EntryLink[];
  canSeeFinancials: boolean;
  canEdit: boolean;
  onEdit: () => void;
  mapsDirectionsUrl?: string;
}

function chipIcon(kind: 'star' | 'dot' | 'clock'): React.ReactNode {
  if (kind === 'clock') {
    return (
      <svg width="10" height="10" viewBox="0 0 12 12" fill="none" aria-hidden>
        <circle cx="6" cy="6" r="4.5" stroke="currentColor" strokeWidth="1.1" />
        <path d="M6 4v2.2l1.4.8" stroke="currentColor" strokeWidth="1.1" strokeLinecap="round" />
      </svg>
    );
  }
  if (kind === 'star') {
    return (
      <svg width="10" height="10" viewBox="0 0 12 12" fill="none" aria-hidden>
        <path d="M6 1.2 7.4 4.6l3.6.3-2.7 2.3.8 3.5L6 9.1 3 10.7l.8-3.5L1 4.9l3.6-.3L6 1.2Z" fill="currentColor" />
      </svg>
    );
  }
  return <span className={styles.statusDot} aria-hidden />;
}

export const MobileFlightDetail: React.FC<MobileFlightDetailProps> = ({
  entry,
  calendarDate,
  documents,
  links,
  canSeeFinancials,
  canEdit,
  onEdit,
  mapsDirectionsUrl
}) => {
  const shellMode = useShellMode();
  const isIpad = shellMode === 'ipad-portrait';
  const { convertToHomeCurrency } = useTripWorkspace();
  const { config } = useConfig();
  const confirmationDoc = findConfirmationDocument(documents);
  const slug = getCategorySlug(entry.category);
  const hasNotes = !isRichTextEditorEmpty(entry.notes);
  const boardingHref = findFlightBoardingPassHref(documents);
  const airlineHref = findFlightAirlineHref(links);

  const data = React.useMemo(
    () =>
      buildFlightDetailData(entry, calendarDate, {
        canSeeFinancials,
        hasConfirmationDoc: Boolean(confirmationDoc),
        convertToHomeCurrency,
        homeCurrency: config.homeCurrency || 'NZD'
      }),
    [entry, calendarDate, canSeeFinancials, confirmationDoc, convertToHomeCurrency, config.homeCurrency]
  );

  const docLinkPills = React.useMemo(() => buildAccommodationDocLinkPills(documents, links), [documents, links]);
  const bp = data.bookingPayment;
  const depTime = data.departs.time;

  return (
    <div className={styles.root} data-shell={isIpad ? 'ipad-portrait' : undefined}>
      <section className={styles.summaryCard}>
        <div className={styles.summaryLeft}>
          <span className={`${styles.summaryCatIcon} th-cat-${slug}`} aria-hidden>
            <CategoryIcon category={entry.category} size={isIpad ? 22 : 18} color="white" />
          </span>
        </div>
        <div className={styles.summaryCenter}>
          <p className={flightStyles.heroTitle}>{data.title}</p>
          <div className={styles.summaryPills}>
            <span className={`${styles.chip} ${styles.chipCat} th-cat-${slug}`}>
              {chipIcon('star')}
              {entry.category}
            </span>
            <span className={`${styles.chip} ${styles.chipStatus}`}>
              {chipIcon('dot')}
              {formatDisplayLabel(entry.decisionStatus)}
            </span>
            {depTime && depTime !== '—' ? (
              <span className={`${styles.chip} ${styles.chipBooked}`}>
                {chipIcon('clock')}
                {depTime}
              </span>
            ) : null}
          </div>
          <p className={styles.summaryLocation}>
            <svg width="11" height="11" viewBox="0 0 12 14" fill="none" aria-hidden>
              <path d="M6 1C3.79 1 2 2.79 2 5c0 3 4 8 4 8s4-5 4-8c0-2.21-1.79-4-4-4z" fill="currentColor" />
            </svg>
            {entry.transportFrom || entry.location || '—'}
          </p>
        </div>
        <div className={styles.summaryRight}>
          {canEdit ? <MobilePencilButton onClick={onEdit} ariaLabel="Edit flight" /> : null}
        </div>
      </section>

      <section className={flightStyles.routeCard}>
        <div className={flightStyles.leg}>
          <span className={flightStyles.legLabel}>Departs</span>
          <span className={flightStyles.legTime}>{data.departs.time}</span>
          <span className={flightStyles.legDate}>{data.departs.date}</span>
          <span className={flightStyles.legPlace}>{data.departs.location}</span>
          {data.departs.sub ? <span className={flightStyles.legSub}>{data.departs.sub}</span> : null}
        </div>
        <div className={flightStyles.routeMid}>
          <span className={flightStyles.planeIcon} aria-hidden>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
              <path d="M3 12h5l2-7 4 1-1 6h6l-1.5 3H13l-1 6-4-1 2-7H3Z" fill="currentColor" />
            </svg>
          </span>
          <span className={flightStyles.routeDuration}>{data.duration}</span>
          <span className={flightStyles.routeStops}>{data.stopLabel}</span>
        </div>
        <div className={flightStyles.leg}>
          <span className={flightStyles.legLabel}>Arrives</span>
          <span className={flightStyles.legTime}>
            {data.arrives.time}
            {data.arrives.dayOffset ? <sup className={flightStyles.dayOffset}>+{data.arrives.dayOffset}</sup> : null}
          </span>
          <span className={flightStyles.legDate}>{data.arrives.date}</span>
          <span className={flightStyles.legPlace}>{data.arrives.location}</span>
        </div>
      </section>

      <section className={styles.sectionCard}>
        <div className={styles.sectionHead}>
          <h2 className={styles.sectionTitle}>Supplier / ticketing</h2>
          {bp.paymentStatus ? (
            <span className={`${styles.inlinePill} ${styles[`pill_${bp.paymentStatus.tone}`]}`}>{bp.paymentStatus.label}</span>
          ) : null}
        </div>
        <div className={styles.bpGrid}>
          <div className={styles.bpField}>
            <span className={styles.gridLabel}>Ticketing airline</span>
            <span className={styles.gridValue}>{data.ticketingAirline}</span>
          </div>
          {data.operatingAirline ? (
            <div className={styles.bpField}>
              <span className={styles.gridLabel}>Operating airline</span>
              <span className={styles.gridValue}>{data.operatingAirline}</span>
            </div>
          ) : null}
          <div className={styles.bpField}>
            <span className={styles.gridLabel}>Booking status</span>
            <span className={`${styles.inlinePill} ${styles[`pill_${bp.bookingStatus.tone}`]}`}>{bp.bookingStatus.label}</span>
          </div>
          <div className={styles.bpField}>
            <span className={styles.gridLabel}>Booking reference</span>
            <span className={styles.gridValue}>{bp.bookingReference}</span>
          </div>
        </div>
      </section>

      <section className={styles.sectionCard}>
        <div className={styles.sectionHead}>
          <h2 className={styles.sectionTitle}>Flight details</h2>
        </div>
        <div className={styles.journeyGrid}>
          {data.flightRows.map((row) => (
            <div key={row.label} className={styles.journeyCell}>
              <span className={styles.gridLabel}>{row.label}</span>
              <span className={styles.gridValue}>{row.value}</span>
            </div>
          ))}
        </div>
      </section>

      {hasNotes ? (
        <section className={styles.sectionCard}>
          <div className={styles.sectionHead}>
            <h2 className={styles.sectionTitle}>Notes</h2>
          </div>
          <div className={styles.notesBody}>
            <RichTextContent html={entry.notes} />
          </div>
        </section>
      ) : null}

      <div className={flightStyles.actionRow}>
        {mapsDirectionsUrl ? (
          <a className={flightStyles.actionTile} href={mapsDirectionsUrl} target="_blank" rel="noopener noreferrer" onClick={(e) => openMobileExternalUrl(mapsDirectionsUrl, e)}>
            <span className={flightStyles.actionTitle}>Directions to airport</span>
            <span className={flightStyles.actionSub}>Open in maps</span>
          </a>
        ) : (
          <span className={`${flightStyles.actionTile} ${flightStyles.actionDisabled}`}>
            <span className={flightStyles.actionTitle}>Directions to airport</span>
          </span>
        )}
        <span className={`${flightStyles.actionTile} ${flightStyles.actionDisabled}`}>
          <span className={flightStyles.actionTitle}>Add to calendar</span>
          <span className={flightStyles.actionSub}>Depart: {data.departs.date}, {data.departs.time}</span>
        </span>
      </div>

      <MobileDetailAiPanel entry={entry} hint="Ask about this flight — baggage, check-in, connections, and more." />

      {docLinkPills.length ? (
        <section className={styles.sectionCard}>
          <div className={styles.sectionHead}>
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
                <span className={styles.docRowLabel}>{p.label}</span>
                <span className={styles.docRowChevron} aria-hidden>↗</span>
              </a>
            ))}
          </div>
        </section>
      ) : boardingHref || airlineHref ? (
        <section className={styles.sectionCard}>
          <div className={styles.sectionHead}>
            <h2 className={styles.sectionTitle}>Documents &amp; links</h2>
          </div>
          <div className={styles.docList}>
            {boardingHref ? (
              <a className={styles.docRow} href={boardingHref} target="_blank" rel="noopener noreferrer" onClick={(e) => openMobileExternalUrl(boardingHref, e)}>
                <span className={styles.docRowLabel}>E-ticket (PDF)</span>
                <span className={styles.docRowChevron} aria-hidden>↗</span>
              </a>
            ) : null}
            {airlineHref ? (
              <a className={styles.docRow} href={airlineHref} target="_blank" rel="noopener noreferrer" onClick={(e) => openMobileExternalUrl(airlineHref, e)}>
                <span className={styles.docRowLabel}>Airline website</span>
                <span className={styles.docRowChevron} aria-hidden>↗</span>
              </a>
            ) : null}
          </div>
        </section>
      ) : null}
    </div>
  );
};
