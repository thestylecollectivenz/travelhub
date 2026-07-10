import * as React from 'react';
import type { ItineraryEntry } from '../../models/ItineraryEntry';
import { CategoryIcon } from '../shared/CategoryIcon';
import { getCategorySlug } from '../../utils/categoryUtils';
import { formatTimeHHMM } from '../../utils/itineraryTimeUtils';
import { entryMapsDirectionsUrl, entryMapsPlaceUrl } from '../../utils/googleMapsLink';
import styles from './MobileStayCruiseTile.module.css';

export interface MobileStayCruiseTileProps {
  mode: 'accommodation' | 'cruise';
  entry: ItineraryEntry;
  calendarDate: string;
  onOpenDetail: () => void;
}

function nightsBetween(start?: string, end?: string): number {
  if (!start || !end) return 1;
  const a = new Date(`${start.slice(0, 10)}T00:00:00.000Z`);
  const b = new Date(`${end.slice(0, 10)}T00:00:00.000Z`);
  if (Number.isNaN(a.getTime()) || Number.isNaN(b.getTime())) return 1;
  return Math.max(1, Math.floor((b.getTime() - a.getTime()) / 86400000));
}

export const MobileStayCruiseTile: React.FC<MobileStayCruiseTileProps> = ({
  mode,
  entry,
  calendarDate,
  onOpenDetail
}) => {
  const [open, setOpen] = React.useState(true);
  const isAcc = mode === 'accommodation';
  const heading = isAcc ? "Tonight's stay" : 'Cruise details';
  const title = entry.title || (isAcc ? 'Accommodation' : 'Cruise');
  const maps = entryMapsPlaceUrl(entry);
  const directions = entryMapsDirectionsUrl(entry);
  const bookingRef = (entry.bookingReference || entry.cruiseReference || '').trim();
  const nights = isAcc ? nightsBetween(entry.dateStart, entry.dateEnd) : 0;
  const booked = entry.bookingStatus === 'Booked';

  const statusLabel = isAcc
    ? `${booked ? 'Booked' : entry.bookingStatus}${nights ? ` · ${nights} night${nights === 1 ? '' : 's'}` : ''}`
    : calendarDate.slice(0, 10) === (entry.embarksDate || '').slice(0, 10)
      ? 'Embarkation day'
      : 'On cruise';

  return (
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
              <CategoryIcon category={entry.category} size={22} color="white" />
            </div>
            <div className={styles.copy}>
              <h3 className={styles.title}>{title}</h3>
              <span className={styles.badge}>{statusLabel}</span>
              {isAcc ? (
                <div className={styles.times}>
                  {entry.checkInTime ? <span>Check-in {formatTimeHHMM(entry.checkInTime)}</span> : null}
                  {entry.checkOutTime ? <span>Check-out {formatTimeHHMM(entry.checkOutTime)}</span> : null}
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
            {maps ? (
              <a className={styles.action} href={maps} target="_blank" rel="noopener noreferrer">
                Open booking
              </a>
            ) : null}
            {directions ? (
              <a className={styles.action} href={directions} target="_blank" rel="noopener noreferrer">
                Directions
              </a>
            ) : null}
            {entry.phoneNumber ? (
              <a className={styles.action} href={`tel:${entry.phoneNumber}`}>
                Call
              </a>
            ) : null}
            <button type="button" className={styles.action} onClick={onOpenDetail}>
              {isAcc ? 'Room details' : 'Cruise info'}
            </button>
          </div>
        </div>
      ) : null}
    </section>
  );
};
