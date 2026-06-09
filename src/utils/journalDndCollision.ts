import {
  closestCenter,
  pointerWithin,
  rectIntersection,
  type CollisionDetection
} from '@dnd-kit/core';
import { isJournalEntryPhotoDropId, isPhotoSortId } from './journalPhotoSortId';

function isPhotoDropTarget(id: string): boolean {
  return isPhotoSortId(id) || isJournalEntryPhotoDropId(id);
}

/** Prefer photo tiles and entry photo zones when dragging photos. */
export const journalFeedCollisionDetection: CollisionDetection = (args) => {
  const activeId = String(args.active.id);

  if (isPhotoSortId(activeId)) {
    const pointer = pointerWithin(args).filter((hit) => isPhotoDropTarget(String(hit.id)));
    if (pointer.length) return pointer;
    const rects = rectIntersection(args).filter((hit) => isPhotoDropTarget(String(hit.id)));
    if (rects.length) return rects;
    return closestCenter(args).filter((hit) => isPhotoDropTarget(String(hit.id)));
  }

  return closestCenter(args).filter((hit) => !isPhotoSortId(String(hit.id)));
};
