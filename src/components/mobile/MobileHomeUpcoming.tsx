import * as React from 'react';
import { useSpContext } from '../../context/SpContext';
import { DayService } from '../../services/DayService';
import { ItineraryService } from '../../services/ItineraryService';
import type { Trip } from '../../models';
import type { MobileTab } from './mobileTypes';
import { CategoryIcon } from '../shared/CategoryIcon';
import { getCategorySlug } from '../../utils/categoryUtils';
import { buildHomeUpcomingItems, type HomeUpcomingItem } from '../../utils/homeUpcomingItems';
import { setPendingTripDay } from '../../utils/mobileTripDayPending';
import styles from './MobileHome.module.css';

export interface MobileHomeUpcomingProps {
  trip?: Trip;
  onOpenTrip: (tripId: string, initialTab?: MobileTab) => void;
}

function countdownLabel(daysUntil: number): string {
  if (daysUntil === 0) return 'Today';
  if (daysUntil === 1) return 'In 1 day';
  return `In ${daysUntil} days`;
}

function UpcomingHeaderIcon(): React.ReactElement {
  return (
    <span className={styles.upcomingHeadIcon} aria-hidden>
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none">
        <rect x="4" y="5" width="16" height="15" rx="2" stroke="currentColor" strokeWidth="1.8" />
        <path d="M8 3.5v3M16 3.5v3M4 10h16" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
      </svg>
    </span>
  );
}

export const MobileHomeUpcoming: React.FC<MobileHomeUpcomingProps> = ({ trip, onOpenTrip }) => {
  const spContext = useSpContext();
  const [items, setItems] = React.useState<HomeUpcomingItem[]>([]);
  const [loading, setLoading] = React.useState(false);

  React.useEffect(() => {
    if (!trip?.id) {
      setItems([]);
      return;
    }
    let cancelled = false;
    setLoading(true);
    const daySvc = new DayService(spContext);
    const entrySvc = new ItineraryService(spContext);
    void Promise.all([daySvc.getAll(trip.id), entrySvc.getAll(trip.id)])
      .then(([days, entries]) => {
        if (cancelled) return;
        setItems(buildHomeUpcomingItems(entries, days, 3));
      })
      .catch((err) => {
        // eslint-disable-next-line no-console
        console.error('MobileHomeUpcoming: load failed', err);
        if (!cancelled) setItems([]);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [trip?.id, spContext]);

  if (!trip) {
    return (
      <section className={styles.homeCard} aria-label="Upcoming">
        <h3 className={styles.homeCardTitle}>Upcoming</h3>
        <p className={styles.homeCardHint}>No trip selected yet.</p>
      </section>
    );
  }

  return (
    <section className={styles.homeCard} aria-label="Upcoming">
      <h3 className={styles.homeCardTitle}>
        <UpcomingHeaderIcon />
        Upcoming
      </h3>
      {loading ? <p className={styles.homeCardHint}>Loading…</p> : null}
      {!loading && !items.length ? (
        <p className={styles.homeCardHint}>No timed items coming up on this trip.</p>
      ) : null}
      <div className={styles.homeCardBody}>
      <ul className={styles.upcomingList}>
        {items.map((item) => (
          <li key={item.id}>
            <button
              type="button"
              className={styles.upcomingItem}
              onClick={() => {
                setPendingTripDay(trip.id, item.dayId, item.ymd);
                onOpenTrip(trip.id, 'today');
              }}
            >
              <span className={styles.upcomingDateBlock} aria-hidden>
                <span className={styles.upcomingWeekday}>{item.weekdayShort}</span>
                <span className={styles.upcomingDayNum}>{item.dayNum}</span>
                <span className={styles.upcomingMonth}>{item.monthShort}</span>
              </span>
              <span className={styles.upcomingMain}>
                <span className={styles.upcomingTitleRow}>
                  <span className={`${styles.upcomingCatIcon} th-cat-${getCategorySlug(item.category)}`}>
                    <CategoryIcon category={item.category} size={14} color="currentColor" />
                  </span>
                  <span className={styles.upcomingTitle}>{item.title}</span>
                </span>
                {item.sub ? <span className={styles.upcomingSub}>{item.sub}</span> : null}
              </span>
              <span className={styles.upcomingPill}>{countdownLabel(item.daysUntil)}</span>
            </button>
          </li>
        ))}
      </ul>
      </div>
      <button type="button" className={styles.homeCardFooter} onClick={() => onOpenTrip(trip.id, 'today')}>
        View full itinerary
        <span aria-hidden> ›</span>
      </button>
    </section>
  );
};
