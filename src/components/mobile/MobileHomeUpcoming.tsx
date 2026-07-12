import * as React from 'react';
import { useSpContext } from '../../context/SpContext';
import { DayService } from '../../services/DayService';
import { ItineraryService } from '../../services/ItineraryService';
import type { Trip } from '../../models';
import type { MobileTab } from './mobileTypes';
import { buildHomeUpcomingItems, type HomeUpcomingItem } from '../../utils/homeUpcomingItems';
import styles from './MobileHome.module.css';

export interface MobileHomeUpcomingProps {
  trip?: Trip;
  onOpenTrip: (tripId: string, initialTab?: MobileTab) => void;
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
      <div className={styles.homeCardHead}>
        <h3 className={styles.homeCardTitle}>Upcoming</h3>
        <button type="button" className={styles.homeCardLink} onClick={() => onOpenTrip(trip.id, 'today')}>
          Itinerary
        </button>
      </div>
      {loading ? <p className={styles.homeCardHint}>Loading…</p> : null}
      {!loading && !items.length ? (
        <p className={styles.homeCardHint}>No timed items coming up on this trip.</p>
      ) : null}
      <ul className={styles.upcomingList}>
        {items.map((item) => (
          <li key={item.id}>
            <button
              type="button"
              className={styles.upcomingItem}
              onClick={() => onOpenTrip(trip.id, 'today')}
            >
              <span className={styles.upcomingDay}>
                {item.dayLabel}
                {item.daysUntil === 0 ? ' · Today' : item.daysUntil === 1 ? ' · Tomorrow' : item.daysUntil > 1 ? ` · in ${item.daysUntil}d` : ''}
              </span>
              <span className={styles.upcomingTitle}>{item.title}</span>
              {item.sub ? <span className={styles.upcomingSub}>{item.sub}</span> : null}
            </button>
          </li>
        ))}
      </ul>
    </section>
  );
};
