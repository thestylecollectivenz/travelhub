import type { DragEndEvent } from '@dnd-kit/core';
import {
  fromJournalEntryPhotoDropId,
  fromPhotoSortId,
  isJournalEntryPhotoDropId,
  isPhotoSortId
} from './journalPhotoSortId';

export type PhotoDragTarget =
  | { kind: 'photo'; photoId: string; entryId: string }
  | { kind: 'entry'; entryId: string };

/** Pick the best drop target for a photo drag, preferring photo tiles over entry zones. */
export function resolvePhotoDragTarget(event: DragEndEvent, activeSortId: string): PhotoDragTarget | null {
  const seen = new Set<string>();
  const hits = [event.over, ...(event.collisions ?? [])].filter((hit): hit is NonNullable<typeof hit> => {
    if (!hit) return false;
    const id = String(hit.id);
    if (id === activeSortId || seen.has(id)) return false;
    seen.add(id);
    return isPhotoSortId(id) || isJournalEntryPhotoDropId(id);
  });

  for (const hit of hits) {
    const id = String(hit.id);
    if (!isPhotoSortId(id)) continue;
    const entryId = hit.data?.current?.entryId as string | undefined;
    if (!entryId) continue;
    return { kind: 'photo', photoId: fromPhotoSortId(id), entryId };
  }

  for (const hit of hits) {
    const id = String(hit.id);
    if (!isJournalEntryPhotoDropId(id)) continue;
    return { kind: 'entry', entryId: fromJournalEntryPhotoDropId(id) };
  }

  return null;
}
