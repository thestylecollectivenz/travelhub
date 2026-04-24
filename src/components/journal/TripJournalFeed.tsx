import * as React from 'react';
import { useJournal } from '../../context/JournalContext';
import { useTripWorkspace } from '../../context/TripWorkspaceContext';
import { JournalEntryCard } from './JournalEntryCard';
import styles from './TripJournalFeed.module.css';

export const TripJournalFeed: React.FC = () => {
  const { allEntries, photosForEntry } = useJournal();
  const { trip, tripDays } = useTripWorkspace();

  const sorted = React.useMemo(
    () => [...allEntries].sort((a, b) => b.entryTimestamp.localeCompare(a.entryTimestamp)),
    [allEntries]
  );

  const dayHeading = React.useCallback(
    (dayId: string): string => {
      const d = tripDays.find((x) => x.id === dayId && trip && x.tripId === trip.id);
      if (!d) return 'Journal';
      return `Day ${d.dayNumber} — ${d.displayTitle}`;
    },
    [trip, tripDays]
  );

  return (
    <section className={styles.root} aria-label="Trip journal">
      <header className={styles.header}>
        <h2 className={styles.title}>Journal</h2>
        <p className={styles.subtitle}>All entries, newest first</p>
      </header>

      {sorted.length === 0 ? (
        <div className={styles.empty} role="status">
          No journal entries for this trip yet.
        </div>
      ) : (
        <div className={styles.list}>
          {sorted.map((e) => (
            <div key={e.id} className={styles.block}>
              <div className={styles.dayTag}>{dayHeading(e.dayId)}</div>
              <JournalEntryCard entry={e} photos={photosForEntry(e.id)} />
            </div>
          ))}
        </div>
      )}
    </section>
  );
};
