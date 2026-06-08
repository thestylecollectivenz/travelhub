import * as React from 'react';
import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import type { JournalEntry, JournalPhoto } from '../../models';
import type { TripDay } from '../../models/TripDay';
import { JournalEntryCard } from './JournalEntryCard';
import styles from './TripJournalFeed.module.css';

export interface JournalEntrySortableProps {
  entry: JournalEntry;
  photos: JournalPhoto[];
  journalDays: TripDay[];
  canModerate: boolean;
  isUnread?: boolean;
}

export const JournalEntrySortable: React.FC<JournalEntrySortableProps> = ({
  entry,
  photos,
  journalDays,
  canModerate,
  isUnread
}) => {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: entry.id });

  const style: React.CSSProperties = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.55 : 1
  };

  return (
    <div ref={setNodeRef} style={style} className={styles.block}>
      <JournalEntryCard
        entry={entry}
        photos={photos}
        journalDays={journalDays}
        canModerate={canModerate}
        isUnread={isUnread}
        dragHandleProps={canModerate ? { ...attributes, ...listeners } : undefined}
      />
    </div>
  );
};
