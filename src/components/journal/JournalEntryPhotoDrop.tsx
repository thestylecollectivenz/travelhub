import * as React from 'react';
import { useDroppable } from '@dnd-kit/core';
import { toJournalEntryPhotoDropId } from '../../utils/journalPhotoSortId';
import styles from './JournalEntryPhotoDrop.module.css';

export interface JournalEntryPhotoDropProps {
  entryId: string;
  enabled: boolean;
  children: React.ReactNode;
}

export const JournalEntryPhotoDrop: React.FC<JournalEntryPhotoDropProps> = ({ entryId, enabled, children }) => {
  const { setNodeRef, isOver } = useDroppable({
    id: toJournalEntryPhotoDropId(entryId),
    disabled: !enabled,
    data: { type: 'photoEntry', entryId }
  });

  return (
    <div ref={setNodeRef} className={`${styles.root} ${isOver ? styles.over : ''}`}>
      {children}
    </div>
  );
};
