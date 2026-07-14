import * as React from 'react';
import type { ItineraryEntry } from '../../models/ItineraryEntry';
import type { EntryDocument } from '../../models/EntryDocument';
import type { EntryLink } from '../../models/EntryLink';
import { CategoryIcon } from '../shared/CategoryIcon';
import { getCategorySlug } from '../../utils/categoryUtils';
import { formatDisplayLabel } from '../../utils/mobileDisplayFormat';
import {
  buildCruiseDetailData,
  findCruiseDeckMapLink,
  type CruiseOverviewCell
} from '../../utils/mobileCruiseDetail';
import { findBoardingPassDocument, findConfirmationDocument, findDeckPlanDocument } from '../../utils/bookingStatusUtils';
import { isRichTextEditorEmpty } from '../../utils/journalRichText';
import { RichTextContent } from '../shared/RichTextContent';
import { MobilePencilButton } from './MobilePencilButton';
import { MobileDetailAiPanel } from './MobileDetailAiPanel';
import { openMobileExternalUrl } from '../../hooks/useMobileDetailHistory';
import { useShellMode } from '../../hooks/useShellMode';
import {
  resolveStayHeroImageUrl,
  stayHeroPlaceholderUrl,
  stayHeroSearchPlace,
  stayHeroSearchTitle
} from '../../utils/stayTileHeroImage';
import styles from './MobileCruiseDetail.module.css';

export interface MobileCruiseDetailProps {
  entry: ItineraryEntry;
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

function overviewIcon(kind: CruiseOverviewCell['icon'], size = 15): React.ReactNode {
  if (kind === 'line' || kind === 'ship') {
    return (
      <svg width={size} height={size} viewBox="0 0 16 16" fill="none" aria-hidden>
        <path d="M2 11h12M4 9V6l4-2 4 2v3" stroke="currentColor" strokeWidth="1.2" strokeLinejoin="round" />
        <path d="M6 11v2M10 11v2" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" />
      </svg>
    );
  }
  if (kind === 'cabin') {
    return (
      <svg width={size} height={size} viewBox="0 0 16 16" fill="none" aria-hidden>
        <path d="M3 9h10v5H3V9Z" stroke="currentColor" strokeWidth="1.2" />
        <path d="M5.5 9V6.5a2.5 2.5 0 0 1 5 0V9" stroke="currentColor" strokeWidth="1.2" />
      </svg>
    );
  }
  if (kind === 'embark' || kind === 'disembark') {
    return (
      <svg width={size} height={size} viewBox="0 0 16 16" fill="none" aria-hidden>
        <rect x="2.5" y="3.5" width="11" height="10" rx="1.2" stroke="currentColor" strokeWidth="1.2" />
        <path d="M5.5 2v2M10.5 2v2M2.5 7h11" stroke="currentColor" strokeWidth="1.2" />
      </svg>
    );
  }
  return (
    <svg width={size} height={size} viewBox="0 0 16 16" fill="none" aria-hidden>
      <rect x="2" y="4" width="12" height="9" rx="1.5" stroke="currentColor" strokeWidth="1.2" />
      <path d="M2 7h12" stroke="currentColor" strokeWidth="1.2" />
    </svg>
  );
}

function actionIcon(kind: 'boarding' | 'deck' | 'port' | 'directions', size = 18): React.ReactNode {
  if (kind === 'boarding') {
    return (
      <svg width={size} height={size} viewBox="0 0 20 20" fill="none" aria-hidden>
        <rect x="3" y="5" width="14" height="12" rx="1.5" stroke="currentColor" strokeWidth="1.3" />
        <path d="M7 3v2M13 3v2M3 9h14" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" />
      </svg>
    );
  }
  if (kind === 'deck') {
    return (
      <svg width={size} height={size} viewBox="0 0 20 20" fill="none" aria-hidden>
        <rect x="3" y="4" width="14" height="12" rx="1.2" stroke="currentColor" strokeWidth="1.3" />
        <path d="M3 8h14M3 12h14M8 4v12M12 4v12" stroke="currentColor" strokeWidth="1" />
      </svg>
    );
  }
  if (kind === 'port') {
    return (
      <svg width={size} height={size} viewBox="0 0 20 20" fill="none" aria-hidden>
        <path d="M10 3C7.24 3 5 5.24 5 8c0 4.25 5 9 5 9s5-4.75 5-9c0-2.76-2.24-5-5-5z" stroke="currentColor" strokeWidth="1.3" />
        <circle cx="10" cy="8" r="1.8" stroke="currentColor" strokeWidth="1.2" />
      </svg>
    );
  }
  return (
    <svg width={size} height={size} viewBox="0 0 20 20" fill="none" aria-hidden>
      <path d="M6 4 14 10 6 16V4Z" stroke="currentColor" strokeWidth="1.4" strokeLinejoin="round" />
    </svg>
  );
}

function sectionIcon(kind: 'wallet' | 'gift' | 'docs' | 'link' | 'notes', size = 14): React.ReactNode {
  if (kind === 'wallet') {
    return (
      <svg width={size} height={size} viewBox="0 0 16 16" fill="none" aria-hidden>
        <rect x="2" y="4" width="12" height="9" rx="1.5" stroke="currentColor" strokeWidth="1.2" />
        <path d="M2 7h12" stroke="currentColor" strokeWidth="1.2" />
      </svg>
    );
  }
  if (kind === 'gift') {
    return (
      <svg width={size} height={size} viewBox="0 0 16 16" fill="none" aria-hidden>
        <rect x="2.5" y="6" width="11" height="7.5" rx="1" stroke="currentColor" strokeWidth="1.2" />
        <path d="M8 6v7.5M2.5 9h11" stroke="currentColor" strokeWidth="1.2" />
        <path d="M8 6c-1.5-2-3-2.5-3.5-1.5S6 6 8 6c2 0 3.5-1.5 3.5-1.5S9.5 3.5 8 6Z" stroke="currentColor" strokeWidth="1.1" />
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
  if (kind === 'link') {
    return (
      <svg width={size} height={size} viewBox="0 0 16 16" fill="none" aria-hidden>
        <path d="M6.5 9.5 9.5 6.5M7 5.5l1.2-1.2a2.5 2.5 0 0 1 3.5 3.5L10.5 9M9 10.5 7.8 11.7a2.5 2.5 0 0 1-3.5-3.5L5.5 7" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" />
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

export const MobileCruiseDetail: React.FC<MobileCruiseDetailProps> = ({
  entry,
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
  const iconSm = isIpad ? 20 : 15;
  const iconAct = isIpad ? 26 : 18;
  const iconSec = isIpad ? 18 : 14;
  const confirmationDoc = findConfirmationDocument(documents);
  const boardingPassDoc = findBoardingPassDocument(documents);
  const deckPlanDoc = findDeckPlanDocument(documents);
  const deckLink = findCruiseDeckMapLink(links);
  const deckHref = deckPlanDoc?.fileUrl || deckLink?.url;
  const slug = getCategorySlug(entry.category);
  const locationLabel = (entry.location ?? '').trim();
  const hasNotes = !isRichTextEditorEmpty(entry.notes);
  const heroTitle = stayHeroSearchTitle(entry, 'cruise');
  const heroPlace = stayHeroSearchPlace(entry, 'cruise');
  const [heroSrc, setHeroSrc] = React.useState(() => stayHeroPlaceholderUrl(heroTitle, heroPlace, 'cruise'));

  const data = React.useMemo(
    () => buildCruiseDetailData(entry, { canSeeFinancials }),
    [entry, canSeeFinancials]
  );

  React.useEffect(() => {
    let cancelled = false;
    setHeroSrc(stayHeroPlaceholderUrl(heroTitle, heroPlace, 'cruise'));
    void resolveStayHeroImageUrl(heroTitle, heroPlace, 'cruise').then((url) => {
      if (!cancelled && url) setHeroSrc(url);
    });
    return () => {
      cancelled = true;
    };
  }, [heroTitle, heroPlace]);

  const openUrl = (url: string, e?: React.MouseEvent): void => openMobileExternalUrl(url, e);

  return (
    <div className={styles.root} data-shell={isIpad ? 'ipad-portrait' : undefined}>
      <section className={styles.overviewCard}>
        <div className={styles.overviewMain}>
          <div className={styles.heroPhotoWrap}>
            <img className={styles.heroPhoto} src={heroSrc} alt="" />
            <span className={`${styles.heroPhotoBadge} th-cat-${slug}`} aria-hidden>
              <CategoryIcon category={entry.category} size={isIpad ? 20 : 18} color="white" />
            </span>
          </div>
          <div className={styles.heroCopy}>
            <div className={styles.heroTitleRow}>
              <h1 className={styles.title}>{entry.title}</h1>
              {canEdit ? <MobilePencilButton onClick={onEdit} ariaLabel="Edit cruise" /> : null}
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
                <svg width={isIpad ? 14 : 11} height={isIpad ? 14 : 11} viewBox="0 0 12 14" fill="none" aria-hidden>
                  <path d="M6 1C3.79 1 2 2.79 2 5c0 3 4 8 4 8s4-5 4-8c0-2.21-1.79-4-4-4z" fill="currentColor" />
                </svg>
                {locationLabel}
              </p>
            ) : null}
          </div>
        </div>
      </section>

      <section className={styles.sectionCard}>
        <div className={styles.sectionHead}>
          <h2 className={styles.sectionTitle}>Trip overview</h2>
        </div>
        <div className={styles.overviewGrid}>
          {data.overview.map((cell) => (
            <div key={cell.label} className={styles.overviewCell}>
              <span className={styles.overviewIcon}>{overviewIcon(cell.icon, iconSm)}</span>
              <span className={styles.overviewLabel}>{cell.label}</span>
              {cell.pillTone ? (
                <span className={`${styles.overviewPill} ${styles[`pill_${cell.pillTone}`]}`}>{cell.value}</span>
              ) : (
                <span className={styles.overviewValue}>{cell.value}</span>
              )}
            </div>
          ))}
        </div>
      </section>

      {data.bookingRows.length ? (
        <section className={styles.sectionCard}>
          <div className={styles.sectionHead}>
            <span className={styles.sectionIcon}>{sectionIcon('wallet', iconSec)}</span>
            <h2 className={styles.sectionTitle}>Booking &amp; payment</h2>
          </div>
          {data.bookingRows.map((row) => (
            <div key={row.label} className={styles.bookingRow}>
              <span className={styles.bookingLabel}>{row.label}</span>
              <span className={`${styles.bookingValue} ${row.highlight ? styles.bookingHighlight : ''}`}>{row.value}</span>
            </div>
          ))}
        </section>
      ) : !canSeeFinancials && entry.cruiseReference ? (
        <section className={styles.sectionCard}>
          <div className={styles.sectionHead}>
            <span className={styles.sectionIcon}>{sectionIcon('wallet', iconSec)}</span>
            <h2 className={styles.sectionTitle}>Booking &amp; payment</h2>
          </div>
          <div className={styles.bookingRow}>
            <span className={styles.bookingLabel}>Cruise reference</span>
            <span className={styles.bookingValue}>{entry.cruiseReference}</span>
          </div>
        </section>
      ) : null}

      <div className={styles.actionGrid}>
        {boardingPassDoc?.fileUrl || confirmationDoc?.fileUrl ? (
          <a
            className={`${styles.actionTile} ${styles.actionPrimary}`}
            href={boardingPassDoc?.fileUrl || confirmationDoc?.fileUrl}
            target="_blank"
            rel="noopener noreferrer"
            onClick={(e) => openUrl(boardingPassDoc?.fileUrl || confirmationDoc?.fileUrl || '', e)}
          >
            {actionIcon('boarding', iconAct)}
            <span>Boarding pass</span>
          </a>
        ) : (
          <span className={`${styles.actionTile} ${styles.actionWashBlue}`} aria-disabled="true">
            {actionIcon('boarding', iconAct)}
            <span>Boarding pass</span>
          </span>
        )}
        {deckHref ? (
          <a
            className={`${styles.actionTile} ${styles.actionWashBlue}`}
            href={deckHref}
            target="_blank"
            rel="noopener noreferrer"
            onClick={(e) => openUrl(deckHref, e)}
          >
            {actionIcon('deck', iconAct)}
            <span>Deck plan</span>
          </a>
        ) : (
          <span className={`${styles.actionTile} ${styles.actionWashBlue}`} aria-disabled="true">
            {actionIcon('deck', iconAct)}
            <span>Deck plan</span>
          </span>
        )}
        {mapsPlaceUrl ? (
          <a
            className={`${styles.actionTile} ${styles.actionWashBlue}`}
            href={mapsPlaceUrl}
            target="_blank"
            rel="noopener noreferrer"
            onClick={(e) => openUrl(mapsPlaceUrl, e)}
          >
            {actionIcon('port', iconAct)}
            <span>Port map</span>
          </a>
        ) : (
          <span className={`${styles.actionTile} ${styles.actionWashBlue}`} aria-disabled="true">
            {actionIcon('port', iconAct)}
            <span>Port map</span>
          </span>
        )}
        {mapsDirectionsUrl ? (
          <a
            className={`${styles.actionTile} ${styles.actionWashBlue}`}
            href={mapsDirectionsUrl}
            target="_blank"
            rel="noopener noreferrer"
            onClick={(e) => openUrl(mapsDirectionsUrl, e)}
          >
            {actionIcon('directions', iconAct)}
            <span>Directions</span>
          </a>
        ) : (
          <span className={`${styles.actionTile} ${styles.actionWashBlue}`} aria-disabled="true">
            {actionIcon('directions', iconAct)}
            <span>Directions</span>
          </span>
        )}
      </div>

      {data.packageName ? (
        <div className={styles.packageCard}>
          <span className={styles.packageIcon} aria-hidden>
            <svg width={isIpad ? 20 : 16} height={isIpad ? 20 : 16} viewBox="0 0 16 16" fill="none">
              <rect x="3" y="5" width="10" height="8" rx="1" stroke="currentColor" strokeWidth="1.2" />
              <path d="M5.5 5V4a2.5 2.5 0 0 1 5 0v1" stroke="currentColor" strokeWidth="1.2" />
            </svg>
          </span>
          <div>
            <span className={styles.packageLabel}>Package</span>
            <p className={styles.packageValue}>{data.packageName}</p>
          </div>
        </div>
      ) : null}

      {data.inclusionItems.length ? (
        <section className={styles.sectionCard}>
          <div className={styles.sectionHead}>
            <span className={`${styles.sectionIcon} ${styles.inclusionIcon}`}>{sectionIcon('gift', iconSec)}</span>
            <h2 className={styles.sectionTitle}>Package inclusions</h2>
          </div>
          <div className={styles.inclusionGrid}>
            {data.inclusionItems.map((item) => (
              <div key={item} className={styles.inclusionItem}>
                <span className={styles.checkIcon} aria-hidden>
                  <svg width={isIpad ? 16 : 12} height={isIpad ? 16 : 12} viewBox="0 0 12 12" fill="none">
                    <circle cx="6" cy="6" r="5" stroke="currentColor" strokeWidth="1.1" />
                    <path d="M3.5 6 5.2 7.7 8.5 4.3" stroke="currentColor" strokeWidth="1.1" strokeLinecap="round" />
                  </svg>
                </span>
                <span>{item}</span>
              </div>
            ))}
          </div>
        </section>
      ) : null}

      {data.obcItems.length ? (
        <section className={styles.obcCard}>
          <div className={styles.obcHead}>
            <span className={styles.obcIcon} aria-hidden>
              <svg width={isIpad ? 18 : 14} height={isIpad ? 18 : 14} viewBox="0 0 16 16" fill="none">
                <path d="M8 1.8 9.6 5.8l4.2.6-3 2.9.7 4.1L8 11.8 4.5 13.4l.7-4.1-3-2.9 4.2-.6L8 1.8Z" stroke="currentColor" strokeWidth="1.1" />
              </svg>
            </span>
            <h2 className={styles.obcTitle}>Onboard credit (OBC)</h2>
          </div>
          <ul className={styles.obcList}>
            {data.obcItems.map((item) => (
              <li key={item}>{item}</li>
            ))}
          </ul>
        </section>
      ) : null}

      {documents.length ? (
        <section className={styles.sectionCard}>
          <div className={styles.sectionHead}>
            <span className={styles.sectionIcon}>{sectionIcon('docs', iconSec)}</span>
            <h2 className={styles.sectionTitle}>Documents</h2>
          </div>
          {documents.map((d) => (
            <a
              key={d.id}
              className={styles.listRow}
              href={d.fileUrl}
              target="_blank"
              rel="noopener noreferrer"
              onClick={(e) => openUrl(d.fileUrl, e)}
            >
              <span className={styles.listRowIcon} aria-hidden>
                <svg width={isIpad ? 18 : 14} height={isIpad ? 18 : 14} viewBox="0 0 14 14" fill="none">
                  <rect x="3" y="1.5" width="8" height="11" rx="1" stroke="currentColor" strokeWidth="1.1" />
                  <path d="M5 5h4M5 7h3" stroke="currentColor" strokeWidth="0.9" strokeLinecap="round" />
                </svg>
              </span>
              <span className={styles.listRowLabel}>{d.title || d.fileName || 'Document'}</span>
              <span className={styles.listRowChevron} aria-hidden>›</span>
            </a>
          ))}
        </section>
      ) : null}

      {links.length ? (
        <section className={styles.sectionCard}>
          <div className={styles.sectionHead}>
            <span className={styles.sectionIcon}>{sectionIcon('link', iconSec)}</span>
            <h2 className={styles.sectionTitle}>Links</h2>
          </div>
          {links.map((l) => (
            <a
              key={l.id}
              className={styles.listRow}
              href={l.url}
              target="_blank"
              rel="noopener noreferrer"
              onClick={(e) => openUrl(l.url, e)}
            >
              <span className={styles.listRowIcon} aria-hidden>
                <svg width={isIpad ? 18 : 14} height={isIpad ? 18 : 14} viewBox="0 0 14 14" fill="none">
                  <circle cx="7" cy="7" r="5" stroke="currentColor" strokeWidth="1.1" />
                </svg>
              </span>
              <span className={styles.listRowLabel}>{l.linkTitle || l.title || l.url}</span>
              <span className={styles.listRowChevron} aria-hidden>›</span>
            </a>
          ))}
        </section>
      ) : null}

      {hasNotes ? (
        <section className={styles.sectionCard}>
          <div className={styles.sectionHead}>
            <span className={styles.sectionIcon}>{sectionIcon('notes', iconSec)}</span>
            <h2 className={styles.sectionTitle}>Notes</h2>
          </div>
          <div className={styles.notesBody}>
            <RichTextContent html={entry.notes} />
          </div>
        </section>
      ) : null}

      <MobileDetailAiPanel entry={entry} hint="Cruise embarkation, ports, and onboard info." />
    </div>
  );
};
