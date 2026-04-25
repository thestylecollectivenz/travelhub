import * as React from 'react';
import type { JournalEntry } from '../../models';
import { useJournal } from '../../context/JournalContext';
import { useTripWorkspace } from '../../context/TripWorkspaceContext';
import { JournalEntryCard } from './JournalEntryCard';
import styles from './TripJournalFeed.module.css';

type SortOrder = 'newest' | 'oldest';

export const TripJournalFeed: React.FC = () => {
  const { allEntries, photosForEntry } = useJournal();
  const { trip, tripDays, sharedPreview } = useTripWorkspace();
  const [sortOrder, setSortOrder] = React.useState<SortOrder>('newest');

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

  const sorted = React.useMemo(() => {
    const list = [...entriesForFeed];
    list.sort((a, b) =>
      sortOrder === 'newest'
        ? b.entryTimestamp.localeCompare(a.entryTimestamp)
        : a.entryTimestamp.localeCompare(b.entryTimestamp)
    );
    return list;
  }, [entriesForFeed, sortOrder]);

  const dayHeading = React.useCallback(
    (dayId: string): string => {
      const d = tripDays.find((x) => x.id === dayId && trip && x.tripId === trip.id);
      if (!d) return 'Journal';
      return `Day ${d.dayNumber} — ${d.displayTitle}`;
    },
    [trip, tripDays]
  );

  /** One section per calendar day: bucket entries by dayId, order sections by trip day number. */
  const groupedByDay = React.useMemo(() => {
    const map = new Map<string, JournalEntry[]>();
    for (const e of sorted) {
      if (!map.has(e.dayId)) map.set(e.dayId, []);
      map.get(e.dayId)!.push(e);
    }
    const sectionOrder =
      trip && tripDays.length
        ? [...tripDays]
            .filter((d) => d.tripId === trip.id)
            .sort((a, b) => a.dayNumber - b.dayNumber)
            .map((d) => d.id)
            .filter((id) => (map.get(id) ?? []).length > 0)
        : Array.from(map.keys());
    return { order: sectionOrder, map };
  }, [sorted, trip, tripDays]);

  return (
    <section className={styles.root} aria-label="Trip journal">
      <header className={styles.header}>
        <h2 className={styles.title}>Journal</h2>
        <div className={styles.sortRow} role="group" aria-label="Sort entries">
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
      </header>

      {sorted.length === 0 ? (
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
