import * as React from 'react';
import { useJournal } from '../../context/JournalContext';
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
  const entries = entriesByDay(dayId);
  const [composerOpen, setComposerOpen] = React.useState(false);

  return (
    <section className={styles.root} aria-label="Travel journal">
      <div className={styles.headerRow}>
        <h2 className={styles.title}>Journal</h2>
        <button type="button" className={styles.writeButton} onClick={() => setComposerOpen(true)}>
          Write an entry
        </button>
      </div>

      {composerOpen ? (
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
