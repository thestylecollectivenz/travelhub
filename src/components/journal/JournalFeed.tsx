import * as React from 'react';
import { useJournal } from '../../context/JournalContext';
import { useTripWorkspace } from '../../context/TripWorkspaceContext';
import { JournalEntryCard } from './JournalEntryCard';
import { JournalEntryComposer } from './JournalEntryComposer';
import styles from './JournalFeed.module.css';

export interface JournalFeedProps {
  dayId: string;
  /** When false, only entry authors see edit/delete (no moderator shortcuts). */
  canModerate?: boolean;
}

export const JournalFeed: React.FC<JournalFeedProps> = ({ dayId, canModerate = true }) => {
  const { entriesByDay, photosForEntry } = useJournal();
  const { tripDays, trip, sharedPreview } = useTripWorkspace();
  const dayMeta = React.useMemo(
    () => tripDays.find((d) => d.id === dayId && trip && d.tripId === trip.id),
    [tripDays, dayId, trip]
  );
  const hidePreTripJournal = sharedPreview || !canModerate;
  const isPreTripDay = dayMeta?.dayType === 'PreTrip';
  const entries =
    hidePreTripJournal && isPreTripDay ? [] : entriesByDay(dayId);
  const allowJournalWrite = !(hidePreTripJournal && isPreTripDay);
  const [composerOpen, setComposerOpen] = React.useState(false);

  return (
    <section className={styles.root} aria-label="Travel journal">
      <div className={styles.headerRow}>
        <h2 className={styles.title}>Journal</h2>
        {allowJournalWrite ? (
          <button type="button" className={styles.writeButton} onClick={() => setComposerOpen(true)}>
            Write an entry
          </button>
        ) : null}
      </div>

      {composerOpen && allowJournalWrite ? (
        <JournalEntryComposer
          dayId={dayId}
          onCancel={() => setComposerOpen(false)}
          onSaved={() => setComposerOpen(false)}
        />
      ) : null}

      {entries.length === 0 && !composerOpen ? (
        <div className={styles.empty}>No journal entries yet for this day</div>
      ) : null}

      <div className={styles.list}>
        {entries.map((e) => (
          <JournalEntryCard key={e.id} entry={e} photos={photosForEntry(e.id)} canModerate={canModerate} />
        ))}
      </div>
    </section>
  );
};
