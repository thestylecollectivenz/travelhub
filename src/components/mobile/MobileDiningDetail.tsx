import * as React from 'react';
import type { ItineraryEntry } from '../../models/ItineraryEntry';
import type { EntryDocument } from '../../models/EntryDocument';
import type { EntryLink } from '../../models/EntryLink';
import { CategoryIcon } from '../shared/CategoryIcon';
import { getCategorySlug } from '../../utils/categoryUtils';
import { formatDisplayLabel } from '../../utils/mobileDisplayFormat';
import { formatTimeHHMM } from '../../utils/itineraryTimeUtils';
import {
  buildDiningDetailData,
  buildDiningDocLinkItems,
  findDiningBookingUrl,
  findDiningMenuLink,
  type DiningGridCell,
  type DiningSummaryCell
} from '../../utils/mobileDiningDetail';
import { findConfirmationDocument } from '../../utils/bookingStatusUtils';
import { isRichTextEditorEmpty } from '../../utils/journalRichText';
import { RichTextContent } from '../shared/RichTextContent';
import { MobilePencilButton } from './MobilePencilButton';
import { openMobileExternalUrl } from '../../hooks/useMobileDetailHistory';
import styles from './MobileDiningDetail.module.css';

export interface MobileDiningDetailProps {
  entry: ItineraryEntry;
  documents: EntryDocument[];
  links: EntryLink[];
  allEntries: ItineraryEntry[];
  calendarDate: string;
  canSeeFinancials: boolean;
  canEdit: boolean;
  onEdit: () => void;
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
  return <span className={styles.statusDot} aria-hidden />;
}

function summaryIcon(kind: DiningSummaryCell['icon']): React.ReactNode {
  if (kind === 'time') {
    return (
      <svg width="14" height="14" viewBox="0 0 16 16" fill="none" aria-hidden>
        <circle cx="8" cy="8" r="5.5" stroke="currentColor" strokeWidth="1.2" />
        <path d="M8 5v3.2l2 1.2" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" />
      </svg>
    );
  }
  if (kind === 'duration') {
    return (
      <svg width="14" height="14" viewBox="0 0 16 16" fill="none" aria-hidden>
        <circle cx="8" cy="8" r="5.5" stroke="currentColor" strokeWidth="1.2" strokeDasharray="2 2" />
      </svg>
    );
  }
  if (kind === 'supplier') {
    return (
      <svg width="14" height="14" viewBox="0 0 16 16" fill="none" aria-hidden>
        <path d="M2 11h12M4 9V6l4-2 4 2v3" stroke="currentColor" strokeWidth="1.2" strokeLinejoin="round" />
      </svg>
    );
  }
  return (
    <svg width="14" height="14" viewBox="0 0 16 16" fill="none" aria-hidden>
      <rect x="2" y="4" width="12" height="9" rx="1.5" stroke="currentColor" strokeWidth="1.2" />
      <path d="M5.5 8.2 7.2 10l3.3-3.8" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" />
    </svg>
  );
}

function actionIcon(kind: 'confirm' | 'menu' | 'save' | 'note'): React.ReactNode {
  if (kind === 'confirm') {
    return (
      <svg width="18" height="18" viewBox="0 0 20 20" fill="none" aria-hidden>
        <rect x="3" y="5" width="14" height="12" rx="1.5" stroke="currentColor" strokeWidth="1.3" />
        <path d="M7 3v2M13 3v2M3 9h14" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" />
      </svg>
    );
  }
  if (kind === 'menu') {
    return (
      <svg width="18" height="18" viewBox="0 0 20 20" fill="none" aria-hidden>
        <path d="M5 4h10v12H5V4Z" stroke="currentColor" strokeWidth="1.3" />
        <path d="M7 8h6M7 11h4" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" />
      </svg>
    );
  }
  if (kind === 'save') {
    return (
      <svg width="18" height="18" viewBox="0 0 20 20" fill="none" aria-hidden>
        <path d="M5 4h8l2 2v11H5V4Z" stroke="currentColor" strokeWidth="1.3" />
        <path d="M7 4v3h6V4" stroke="currentColor" strokeWidth="1.3" />
      </svg>
    );
  }
  return (
    <svg width="18" height="18" viewBox="0 0 20 20" fill="none" aria-hidden>
      <rect x="4" y="3" width="12" height="14" rx="1.2" stroke="currentColor" strokeWidth="1.3" />
      <path d="M7 9h6M7 12h4" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" />
    </svg>
  );
}

function sectionIcon(kind: 'wallet' | 'dining' | 'docs' | 'notes'): React.ReactNode {
  if (kind === 'wallet') {
    return (
      <svg width="14" height="14" viewBox="0 0 16 16" fill="none" aria-hidden>
        <rect x="2" y="4" width="12" height="9" rx="1.5" stroke="currentColor" strokeWidth="1.2" />
        <path d="M2 7h12" stroke="currentColor" strokeWidth="1.2" />
      </svg>
    );
  }
  if (kind === 'dining') {
    return (
      <svg width="14" height="14" viewBox="0 0 16 16" fill="none" aria-hidden>
        <path d="M5 3v10M3 3v4M7 3v4M5 7v6" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" />
        <path d="M11 3v5c0 1.5 1 2.5 2 2.5V3" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" />
      </svg>
    );
  }
  if (kind === 'docs') {
    return (
      <svg width="14" height="14" viewBox="0 0 16 16" fill="none" aria-hidden>
        <path d="M6 4.5h4l2.5 2.5V12a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V5.5a1 1 0 0 1 1-1h1Z" stroke="currentColor" strokeWidth="1.2" />
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

function GridCell({ cell: c }: { cell: DiningGridCell }): React.ReactElement {
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

function GridRow({ cells, bordered }: { cells: DiningGridCell[]; bordered?: boolean }): React.ReactElement | null {
  if (!cells.length) return null;
  return (
    <div className={`${styles.gridRow} ${bordered ? styles.gridRowBordered : ''}`}>
      {cells.map((c) => (
        <GridCell key={c.label} cell={c} />
      ))}
    </div>
  );
}

export const MobileDiningDetail: React.FC<MobileDiningDetailProps> = ({
  entry,
  documents,
  links,
  allEntries,
  calendarDate,
  canSeeFinancials,
  canEdit,
  onEdit
}) => {
  const notesRef = React.useRef<HTMLElement>(null);
  const confirmationDoc = findConfirmationDocument(documents);
  const menuUrl = findDiningMenuLink(links, documents);
  const bookingUrl = findDiningBookingUrl(links);
  const slug = getCategorySlug(entry.category);
  const locationLabel = (entry.location ?? '').trim();
  const timeChip = entry.timeStart ? formatTimeHHMM(entry.timeStart) : '';
  const hasNotes = !isRichTextEditorEmpty(entry.notes);

  const data = React.useMemo(
    () =>
      buildDiningDetailData(entry, {
        canSeeFinancials,
        hasConfirmationDoc: Boolean(confirmationDoc),
        calendarDate,
        allEntries
      }),
    [entry, canSeeFinancials, confirmationDoc, calendarDate, allEntries]
  );

  const docLinkItems = React.useMemo(() => buildDiningDocLinkItems(documents, links), [documents, links]);

  const scrollToNotes = (): void => {
    notesRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };

  const openUrl = (url: string, e?: React.MouseEvent): void => openMobileExternalUrl(url, e);

  return (
    <>
      <header className={styles.hero}>
        <div className={`${styles.heroIcon} th-cat-${slug}`}>
          <CategoryIcon category={entry.category} size={26} color="white" />
        </div>
        <div className={styles.heroCopy}>
          <div className={styles.heroTitleRow}>
            <h1 className={styles.title}>{entry.title}</h1>
            {canEdit ? <MobilePencilButton onClick={onEdit} ariaLabel="Edit dining item" /> : null}
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
            {timeChip ? (
              <span className={`${styles.chip} ${styles.chipTime}`}>
                {chipIcon('clock')}
                {timeChip}
              </span>
            ) : null}
          </div>
          {locationLabel ? (
            <p className={styles.locationLine}>
              <svg width="11" height="11" viewBox="0 0 12 14" fill="none" aria-hidden>
                <path d="M6 1C3.79 1 2 2.79 2 5c0 3 4 8 4 8s4-5 4-8c0-2.21-1.79-4-4-4z" fill="currentColor" />
              </svg>
              {locationLabel}
            </p>
          ) : null}
        </div>
      </header>

      <div className={styles.actionGrid}>
        {confirmationDoc?.fileUrl ? (
          <a
            className={styles.actionTile}
            href={confirmationDoc.fileUrl}
            target="_blank"
            rel="noopener noreferrer"
            onClick={(e) => openUrl(confirmationDoc.fileUrl, e)}
          >
            {actionIcon('confirm')}
            <span>Open confirmation</span>
          </a>
        ) : (
          <span className={`${styles.actionTile} ${styles.actionDisabled}`} aria-disabled="true">
            {actionIcon('confirm')}
            <span>Open confirmation</span>
          </span>
        )}
        {menuUrl ? (
          <a className={styles.actionTile} href={menuUrl} target="_blank" rel="noopener noreferrer" onClick={(e) => openUrl(menuUrl, e)}>
            {actionIcon('menu')}
            <span>Menu</span>
          </a>
        ) : (
          <span className={`${styles.actionTile} ${styles.actionDisabled}`} aria-disabled="true">
            {actionIcon('menu')}
            <span>Menu</span>
          </span>
        )}
        {bookingUrl ? (
          <a
            className={styles.actionTile}
            href={bookingUrl}
            target="_blank"
            rel="noopener noreferrer"
            onClick={(e) => openUrl(bookingUrl, e)}
          >
            {actionIcon('confirm')}
            <span>Book</span>
          </a>
        ) : (
          <span className={`${styles.actionTile} ${styles.actionDisabled}`} aria-disabled="true">
            {actionIcon('confirm')}
            <span>Book</span>
          </span>
        )}
        <button
          type="button"
          className={`${styles.actionTile} ${!hasNotes ? styles.actionDisabled : ''}`}
          onClick={hasNotes ? scrollToNotes : undefined}
          disabled={!hasNotes}
          aria-disabled={!hasNotes}
        >
          {actionIcon('note')}
          <span>View notes</span>
        </button>
      </div>

      <section className={styles.summaryRow}>
        {data.summary.map((cell) => (
          <div key={cell.label} className={styles.summaryCell}>
            <span className={styles.summaryIcon}>{summaryIcon(cell.icon)}</span>
            <span className={styles.summaryLabel}>{cell.label}</span>
            <span className={`${styles.summaryValue} ${cell.highlight ? styles.summaryHighlight : ''}`}>{cell.value}</span>
          </div>
        ))}
      </section>

      {(data.bookingRow1.length || data.bookingRow2.length) && canSeeFinancials ? (
        <section className={styles.sectionCard}>
          <div className={styles.sectionHead}>
            <span className={styles.sectionIcon}>{sectionIcon('wallet')}</span>
            <h2 className={styles.sectionTitle}>Booking &amp; payment</h2>
          </div>
          <GridRow cells={data.bookingRow1} bordered />
          {data.bookingRow1.length && data.bookingRow2.length ? <div className={styles.rowDivider} /> : null}
          <GridRow cells={data.bookingRow2} bordered />
        </section>
      ) : null}

      <section className={styles.sectionCard}>
        <div className={styles.sectionHead}>
          <span className={styles.sectionIcon}>{sectionIcon('dining')}</span>
          <h2 className={styles.sectionTitle}>Dining details</h2>
        </div>
        <GridRow cells={data.diningRow1} bordered />
        {data.onCruiseItinerary ? (
          <div className={styles.diningRow2}>
            <div className={styles.cruiseCallout}>
              <span className={styles.cruiseCalloutIcon} aria-hidden>
                <svg width="14" height="14" viewBox="0 0 16 16" fill="none">
                  <path d="M2 11h12M4 9V6l4-2 4 2v3" stroke="currentColor" strokeWidth="1.2" strokeLinejoin="round" />
                </svg>
              </span>
              <p className={styles.cruiseCalloutText}>This dinner is part of your cruise itinerary.</p>
            </div>
          </div>
        ) : null}
      </section>

      {docLinkItems.length ? (
        <section className={styles.sectionCard}>
          <div className={styles.sectionHead}>
            <span className={styles.sectionIcon}>{sectionIcon('docs')}</span>
            <h2 className={styles.sectionTitle}>Documents &amp; links</h2>
          </div>
          <div className={styles.docLinkRow}>
            {docLinkItems.map((item) => (
              <a
                key={item.id}
                className={styles.docLinkItem}
                href={item.href}
                target="_blank"
                rel="noopener noreferrer"
                onClick={(e) => openUrl(item.href, e)}
              >
                {item.kind === 'document' ? (
                  <svg width="12" height="12" viewBox="0 0 12 12" fill="none" aria-hidden>
                    <rect x="2" y="1.5" width="8" height="9" rx="1" stroke="currentColor" strokeWidth="1" />
                  </svg>
                ) : (
                  <svg width="12" height="12" viewBox="0 0 12 12" fill="none" aria-hidden>
                    <circle cx="6" cy="6" r="4.5" stroke="currentColor" strokeWidth="1" />
                  </svg>
                )}
                <span>{item.label}</span>
                {item.kind === 'link' ? (
                  <svg width="10" height="10" viewBox="0 0 10 10" fill="none" aria-hidden>
                    <path d="M3.5 1.5h5v5M8.5 1.5 1.5 8.5" stroke="currentColor" strokeWidth="1.1" strokeLinecap="round" />
                  </svg>
                ) : null}
              </a>
            ))}
          </div>
        </section>
      ) : null}

      {hasNotes ? (
        <section className={styles.sectionCard} id="dining-notes" ref={notesRef}>
          <div className={styles.sectionHead}>
            <span className={styles.sectionIcon}>{sectionIcon('notes')}</span>
            <h2 className={styles.sectionTitle}>Notes</h2>
          </div>
          <div className={styles.notesBody}>
            <RichTextContent html={entry.notes} />
          </div>
        </section>
      ) : null}
    </>
  );
};
