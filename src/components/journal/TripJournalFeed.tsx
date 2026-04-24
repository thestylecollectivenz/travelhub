import * as React from 'react';
import type { JournalEntry } from '../../models';
import { useJournal } from '../../context/JournalContext';
import { useTripWorkspace } from '../../context/TripWorkspaceContext';
import { JournalEntryCard } from './JournalEntryCard';
import styles from './TripJournalFeed.module.css';

type SortOrder = 'newest' | 'oldest';

export const TripJournalFeed: React.FC = () => {
  const { allEntries, photosForEntry } = useJournal();
  const { trip, tripDays } = useTripWorkspace();
  const [sortOrder, setSortOrder] = React.useState<SortOrder>('newest');

  const sorted = React.useMemo(() => {
    const list = [...allEntries];
    list.sort((a, b) =>
      sortOrder === 'newest'
        ? b.entryTimestamp.localeCompare(a.entryTimestamp)
        : a.entryTimestamp.localeCompare(b.entryTimestamp)
    );
    return list;
  }, [allEntries, sortOrder]);

  const dayHeading = React.useCallback(
    (dayId: string): string => {
      const d = tripDays.find((x) => x.id === dayId && trip && x.tripId === trip.id);
      if (!d) return 'Journal';
      return `Day ${d.dayNumber} — ${d.displayTitle}`;
    },
    [trip, tripDays]
  );

  const groupedByDay = React.useMemo(() => {
    const order: string[] = [];
    const map = new Map<string, JournalEntry[]>();
    for (const e of sorted) {
      if (!map.has(e.dayId)) {
        map.set(e.dayId, []);
        order.push(e.dayId);
      }
      map.get(e.dayId)!.push(e);
    }
    return { order, map };
  }, [sorted]);

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
                    <JournalEntryCard entry={e} photos={photosForEntry(e.id)} />
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
