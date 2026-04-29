import * as React from 'react';
import type { JournalEntry } from '../../models';
import { useJournal } from '../../context/JournalContext';
import { useTripWorkspace } from '../../context/TripWorkspaceContext';
import { JournalEntryCard } from './JournalEntryCard';
import styles from './TripJournalFeed.module.css';

type SortOrder = 'newest' | 'oldest';
type ReadFilter = 'all' | 'unread' | 'read';

export const TripJournalFeed: React.FC = () => {
  const { allEntries, photosForEntry } = useJournal();
  const { trip, tripDays, sharedPreview } = useTripWorkspace();
  const [sortOrder, setSortOrder] = React.useState<SortOrder>('newest');
  const [readFilter, setReadFilter] = React.useState<ReadFilter>('all');
  const [lastSeenAt, setLastSeenAt] = React.useState<string | null>(null);

  React.useEffect(() => {
    if (!trip?.id) return;
    const key = `travelhub-journal-last-seen-${trip.id}`;
    const prev = window.localStorage.getItem(key);
    setLastSeenAt(prev);
    window.localStorage.setItem(key, new Date().toISOString());
  }, [trip?.id]);

  const hidePreTripJournal = sharedPreview;

  const preTripDayIds = React.useMemo(() => {
    if (!trip) return new Set<string>();
    return new Set(
      tripDays.filter((d) => d.tripId === trip.id && d.dayType === 'PreTrip').map((d) => d.id)
    );
  }, [trip, tripDays]);

  const entriesForFeed = React.useMemo(() => {
    if (!hidePreTripJournal) return allEntries;
    return allEntries.filter((e) => !preTripDayIds.has(e.dayId));
  }, [allEntries, hidePreTripJournal, preTripDayIds]);

  const isUnread = React.useCallback(
    (entry: JournalEntry): boolean => {
      if (!lastSeenAt) return true;
      return entry.entryTimestamp > lastSeenAt;
    },
    [lastSeenAt]
  );

  const filteredEntries = React.useMemo(() => {
    if (readFilter === 'all') return entriesForFeed;
    return entriesForFeed.filter((entry) => (readFilter === 'unread' ? isUnread(entry) : !isUnread(entry)));
  }, [entriesForFeed, readFilter, isUnread]);

  const dayHeading = React.useCallback(
    (dayId: string): string => {
      const d = tripDays.find((x) => x.id === dayId && trip && x.tripId === trip.id);
      if (!d) return 'Journal';
      if (d.dayType === 'PreTrip') return 'Pre-trip';
      return `Day ${d.dayNumber} — ${d.displayTitle}`;
    },
    [trip, tripDays]
  );

  /** One section per itinerary day. Day sort is controlled above; entries stay oldest -> newest. */
  const groupedByDay = React.useMemo(() => {
    const map = new Map<string, JournalEntry[]>();
    for (const e of filteredEntries) {
      if (!map.has(e.dayId)) map.set(e.dayId, []);
      map.get(e.dayId)!.push(e);
    }
    for (const [dayId, entries] of Array.from(map.entries())) {
      map.set(
        dayId,
        [...entries].sort((a, b) => a.entryTimestamp.localeCompare(b.entryTimestamp))
      );
    }
    const sectionOrder =
      trip && tripDays.length
        ? [...tripDays]
            .filter((d) => d.tripId === trip.id && (!hidePreTripJournal || d.dayType !== 'PreTrip'))
            .sort((a, b) => (sortOrder === 'newest' ? b.dayNumber - a.dayNumber : a.dayNumber - b.dayNumber))
            .map((d) => d.id)
            .filter((id) => (map.get(id) ?? []).length > 0)
        : Array.from(map.keys());
    return { order: sectionOrder, map };
  }, [filteredEntries, trip, tripDays, sortOrder, hidePreTripJournal]);

  return (
    <section className={styles.root} aria-label="Trip journal">
      <header className={styles.header}>
        <h2 className={styles.title}>Journal</h2>
        <div className={styles.sortRow} role="group" aria-label="Sort entries">
          <button
            type="button"
            className={styles.exportAction}
            onClick={() => window.dispatchEvent(new CustomEvent('open-journal-export'))}
          >
            Export journal
          </button>
          <span className={styles.sortLabel}>Order</span>
          <button
            type="button"
            className={`${styles.sortBtn} ${sortOrder === 'newest' ? styles.sortBtnActive : ''}`}
            onClick={() => setSortOrder('newest')}
          >
            Newest first
          </button>
          <button
            type="button"
            className={`${styles.sortBtn} ${sortOrder === 'oldest' ? styles.sortBtnActive : ''}`}
            onClick={() => setSortOrder('oldest')}
          >
            Oldest first
          </button>
        </div>
        <div className={styles.filterRow} role="group" aria-label="Filter by read status">
          <span className={styles.sortLabel}>Show</span>
          <button
            type="button"
            className={`${styles.sortBtn} ${readFilter === 'all' ? styles.sortBtnActive : ''}`}
            onClick={() => setReadFilter('all')}
          >
            All
          </button>
          <button
            type="button"
            className={`${styles.sortBtn} ${readFilter === 'unread' ? styles.sortBtnActive : ''}`}
            onClick={() => setReadFilter('unread')}
          >
            Unread
          </button>
          <button
            type="button"
            className={`${styles.sortBtn} ${readFilter === 'read' ? styles.sortBtnActive : ''}`}
            onClick={() => setReadFilter('read')}
          >
            Read
          </button>
        </div>
      </header>

      {filteredEntries.length === 0 ? (
        <div className={styles.empty} role="status">
          No journal entries for this trip yet.
        </div>
      ) : (
        <div className={styles.list}>
          {groupedByDay.order.map((dayId) => (
            <section key={dayId} className={styles.daySection} aria-label={dayHeading(dayId)}>
              <h3 className={styles.dayTag}>{dayHeading(dayId)}</h3>
              <div className={styles.dayEntries}>
                {(groupedByDay.map.get(dayId) ?? []).map((e) => (
                  <div key={e.id} className={styles.block}>
                    <JournalEntryCard entry={e} photos={photosForEntry(e.id)} canModerate={!sharedPreview} />
                  </div>
                ))}
              </div>
            </section>
          ))}
        </div>
      )}
    </section>
  );
};
