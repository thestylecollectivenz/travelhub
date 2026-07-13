import * as React from 'react';
import type { ItineraryEntry } from '../../models/ItineraryEntry';
import { useAttachments } from '../../context/AttachmentsContext';
import { CategoryIcon } from '../shared/CategoryIcon';
import { getCategorySlug } from '../../utils/categoryUtils';
import { formatAccommodationArriveLabel, formatAccommodationDepartLabel } from '../../utils/itineraryTimeUtils';
import { isAccommodationCheckoutOnCalendarDate } from '../../utils/itineraryDayEntries';
import { entryMapsDirectionsUrl } from '../../utils/googleMapsLink';
import {
  bookingPartnerSearchUrls,
  effectiveBookingStatus,
  findBoardingPassDocument,
  findConfirmationDocument,
  findDeckPlanDocument
} from '../../utils/bookingStatusUtils';
import { resolveStayHeroImageUrl, stayHeroPlaceholderUrl } from '../../utils/stayTileHeroImage';
import { MobileBookingSiteSheet } from './MobileBookingSiteSheet';
import styles from './MobileStayCruiseTile.module.css';

export interface MobileStayCruiseTileProps {
  mode: 'accommodation' | 'cruise';
  entry: ItineraryEntry;
  calendarDate: string;
  onOpenDetail: () => void;
}

interface TilePill {
  key: string;
  label: string;
  icon: 'booking' | 'directions' | 'call' | 'info' | 'doc';
  href?: string;
  onClick?: () => void;
  primary?: boolean;
  disabled?: boolean;
}

function nightsBetween(start?: string, end?: string): number {
  if (!start || !end) return 1;
  const a = new Date(`${start.slice(0, 10)}T00:00:00.000Z`);
  const b = new Date(`${end.slice(0, 10)}T00:00:00.000Z`);
  if (Number.isNaN(a.getTime()) || Number.isNaN(b.getTime())) return 1;
  return Math.max(1, Math.floor((b.getTime() - a.getTime()) / 86400000));
}

function pillIcon(kind: TilePill['icon']): React.ReactNode {
  if (kind === 'booking') {
    return (
      <svg width="14" height="14" viewBox="0 0 16 16" fill="none" aria-hidden>
        <rect x="2" y="3" width="12" height="11" rx="1.5" stroke="currentColor" strokeWidth="1.2" />
        <path d="M2 6.5h12M5 1.5v2M11 1.5v2" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" />
        <path d="M6.5 9.5l1 1 2.5-2.5" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    );
  }
  if (kind === 'directions') {
    return (
      <svg width="14" height="14" viewBox="0 0 16 16" fill="none" aria-hidden>
        <path d="M8 1.5C5.5 1.5 3.5 3.5 3.5 6c0 4.5 4.5 8.5 4.5 8.5S12.5 10.5 12.5 6c0-2.5-2-4.5-4.5-4.5z" stroke="currentColor" strokeWidth="1.2" />
        <circle cx="8" cy="6" r="1.5" fill="currentColor" />
      </svg>
    );
  }
  if (kind === 'call') {
    return (
      <svg width="14" height="14" viewBox="0 0 16 16" fill="none" aria-hidden>
        <path
          d="M4.2 2.5h2.2l1 2.4-1.4 1c.8 1.6 2.1 2.9 3.7 3.7l1-1.4 2.4 1v2.2c0 .6-.5 1.1-1.1 1.1C6.8 12.5 3.5 9.2 3.1 4.6c0-.6.5-1.1 1.1-1.1z"
          stroke="currentColor"
          strokeWidth="1.2"
          strokeLinejoin="round"
        />
      </svg>
    );
  }
  if (kind === 'doc') {
    return (
      <svg width="14" height="14" viewBox="0 0 16 16" fill="none" aria-hidden>
        <path d="M4 1.5h5l3 3V14.5H4V1.5Z" stroke="currentColor" strokeWidth="1.2" />
        <path d="M9 1.5V5h3" stroke="currentColor" strokeWidth="1.2" />
      </svg>
    );
  }
  return (
    <svg width="14" height="14" viewBox="0 0 16 16" fill="none" aria-hidden>
      <circle cx="8" cy="8" r="6" stroke="currentColor" strokeWidth="1.2" />
      <path d="M8 7v4M8 5.5v.5" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
    </svg>
  );
}

export const MobileStayCruiseTile: React.FC<MobileStayCruiseTileProps> = ({
  mode,
  entry,
  calendarDate,
  onOpenDetail
}) => {
  const { documents } = useAttachments();
  const [open, setOpen] = React.useState(true);
  const [showBookingSites, setShowBookingSites] = React.useState(false);
  const isAcc = mode === 'accommodation';
  const heading = isAcc ? "Tonight's stay" : 'Cruise details';
  const title = entry.title || (isAcc ? 'Accommodation' : 'Cruise');
  const directions = entryMapsDirectionsUrl(entry);
  const bookingRef = (entry.bookingReference || entry.cruiseReference || '').trim();
  const nights = isAcc ? nightsBetween(entry.dateStart, entry.dateEnd) : 0;
  const entryDocs = documents.filter((d) => d.entryId === entry.id);
  const confirmationDoc = findConfirmationDocument(entryDocs);
  const boardingPassDoc = findBoardingPassDocument(entryDocs);
  const deckPlanDoc = findDeckPlanDocument(entryDocs);
  const booked = effectiveBookingStatus(entry, { hasConfirmationDoc: Boolean(confirmationDoc) });

  const statusLabel = isAcc
    ? `${booked ? 'Booked' : 'Not booked'}${nights ? ` · ${nights} night${nights === 1 ? '' : 's'}` : ''}`
    : calendarDate.slice(0, 10) === (entry.embarksDate || '').slice(0, 10)
      ? 'Embarkation day'
      : 'On cruise';

  const bookingSiteOptions = React.useMemo(
    () => bookingPartnerSearchUrls(entry.title || entry.location || 'hotel', entry.dateStart, entry.dateEnd),
    [entry.dateStart, entry.dateEnd, entry.location, entry.title]
  );
  const locationLabel = entry.location || entry.title || '';
  const [heroUrl, setHeroUrl] = React.useState(() =>
    stayHeroPlaceholderUrl(title, locationLabel, mode)
  );
  const [heroFailed, setHeroFailed] = React.useState(false);

  React.useEffect(() => {
    let cancelled = false;
    setHeroFailed(false);
    setHeroUrl(stayHeroPlaceholderUrl(title, locationLabel, mode));
    void resolveStayHeroImageUrl(title, locationLabel, mode).then((url) => {
      if (!cancelled && url) setHeroUrl(url);
    });
    return () => {
      cancelled = true;
    };
  }, [title, locationLabel, mode]);

  const pills = React.useMemo((): TilePill[] => {
    const list: TilePill[] = [];
    if (isAcc) {
      if (booked) {
        list.push({
          key: 'booking',
          label: 'Open booking',
          icon: 'booking',
          href: confirmationDoc?.fileUrl,
          primary: true,
          disabled: !confirmationDoc?.fileUrl
        });
      } else {
        list.push({
          key: 'book',
          label: 'Book now',
          icon: 'booking',
          onClick: () => setShowBookingSites(true),
          primary: true
        });
      }
    }
    if (directions) {
      list.push({ key: 'directions', label: 'Directions', icon: 'directions', href: directions });
    }
    if (!isAcc) {
      list.push({
        key: 'boarding',
        label: 'Boarding pass',
        icon: 'doc',
        href: boardingPassDoc?.fileUrl,
        primary: Boolean(boardingPassDoc?.fileUrl),
        disabled: !boardingPassDoc?.fileUrl
      });
      list.push({
        key: 'deck',
        label: 'Deck plan',
        icon: 'doc',
        href: deckPlanDoc?.fileUrl,
        primary: Boolean(deckPlanDoc?.fileUrl),
        disabled: !deckPlanDoc?.fileUrl
      });
    }
    if (entry.phoneNumber?.trim()) {
      list.push({ key: 'call', label: 'Call', icon: 'call', href: `tel:${entry.phoneNumber.trim()}` });
    }
    list.push({
      key: 'info',
      label: isAcc ? 'Room details' : 'Cruise info',
      icon: 'info',
      onClick: onOpenDetail
    });
    return list;
  }, [
    isAcc,
    booked,
    confirmationDoc?.fileUrl,
    directions,
    boardingPassDoc?.fileUrl,
    deckPlanDoc?.fileUrl,
    entry.phoneNumber,
    onOpenDetail
  ]);

  const pillClass = (pill: TilePill): string => {
    const parts = [styles.pill];
    if (pill.disabled) parts.push(styles.pillDisabled);
    if (pill.primary) {
      parts.push(isAcc ? styles.pillPrimaryRust : styles.pillPrimaryBlue);
    } else if (isAcc) {
      parts.push(styles.pillWashRust);
    } else {
      parts.push(styles.pillWashBlue);
    }
    return parts.join(' ');
  };

  return (
    <>
      <section className={`${styles.tile} ${isAcc ? styles.tileStay : styles.tileCruise}`}>
        <button type="button" className={styles.head} onClick={() => setOpen((v) => !v)} aria-expanded={open}>
          <span className={styles.kicker}>{heading}</span>
          <span className={styles.chevron} aria-hidden>
            {open ? '▾' : '▸'}
          </span>
        </button>
        {open ? (
          <div className={styles.body}>
            <button type="button" className={styles.main} onClick={onOpenDetail}>
              <div className={`${styles.thumb} th-cat-${getCategorySlug(entry.category)}`}>
                {!heroFailed ? (
                  <img
                    className={styles.thumbImg}
                    src={heroUrl}
                    alt=""
                    onError={() => setHeroFailed(true)}
                  />
                ) : (
                  <CategoryIcon category={entry.category} size={22} color="white" />
                )}
              </div>
              <div className={styles.copy}>
                <h3 className={styles.title}>{title}</h3>
                <div className={styles.badgeRow}>
                  <span className={`${styles.badge} ${booked ? styles.badgeBooked : styles.badgePending}`}>
                    {isAcc ? (booked ? 'Booked' : 'Not booked') : statusLabel}
                  </span>
                  {isAcc && nights > 0 ? (
                    <span className={`${styles.badge} ${styles.badgeWash}`}>{nights} night{nights === 1 ? '' : 's'}</span>
                  ) : null}
                  {!isAcc && entry.cruiseLineName ? (
                    <span className={`${styles.badge} ${styles.badgeWash}`}>{entry.cruiseLineName}</span>
                  ) : null}
                </div>
                {isAcc ? (
                  <div className={styles.times}>
                    {isAccommodationCheckoutOnCalendarDate(entry, calendarDate) ? (
                      <span>{formatAccommodationDepartLabel(entry)}</span>
                    ) : (
                      <span>{formatAccommodationArriveLabel(entry)}</span>
                    )}
                  </div>
                ) : (
                  <p className={styles.sub}>
                    {[entry.cruiseLineName, entry.shipName].filter(Boolean).join(' · ') || entry.location}
                  </p>
                )}
                {entry.location ? (
                  <p className={styles.addr}>
                    <svg width="11" height="11" viewBox="0 0 12 14" fill="none" aria-hidden>
                      <path d="M6 1C3.79 1 2 2.79 2 5c0 3 4 8 4 8s4-5 4-8c0-2.21-1.79-4-4-4z" fill="currentColor" />
                    </svg>
                    {entry.location}
                  </p>
                ) : null}
                {bookingRef ? <p className={styles.ref}>Booking ref. {bookingRef}</p> : null}
              </div>
            </button>
            <div className={styles.actions}>
              {pills.map((pill) => {
                const className = pillClass(pill);
                if (pill.href && !pill.disabled) {
                  return (
                    <a key={pill.key} className={className} href={pill.href} target="_blank" rel="noopener noreferrer">
                      {pillIcon(pill.icon)}
                      {pill.label}
                    </a>
                  );
                }
                if (pill.onClick && !pill.disabled) {
                  return (
                    <button key={pill.key} type="button" className={className} onClick={pill.onClick}>
                      {pillIcon(pill.icon)}
                      {pill.label}
                    </button>
                  );
                }
                return (
                  <span key={pill.key} className={className} aria-disabled="true">
                    {pillIcon(pill.icon)}
                    {pill.label}
                  </span>
                );
              })}
            </div>
          </div>
        ) : null}
      </section>
      {showBookingSites ? (
        <MobileBookingSiteSheet title={title} options={bookingSiteOptions} onClose={() => setShowBookingSites(false)} />
      ) : null}
    </>
  );
};
