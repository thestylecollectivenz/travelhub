import {
  closestCenter,
  pointerWithin,
  rectIntersection,
  type Collision,
  type CollisionDetection
} from '@dnd-kit/core';
import { isJournalEntryPhotoDropId, isPhotoSortId } from './journalPhotoSortId';

function isPhotoDropTarget(id: string): boolean {
  return isPhotoSortId(id) || isJournalEntryPhotoDropId(id);
}

/** Photo tiles beat entry drop zones so within-entry reorder resolves correctly. */
function preferPhotoTiles(hits: Collision[]): Collision[] {
  const tiles = hits.filter((hit) => isPhotoSortId(String(hit.id)));
  if (tiles.length) return tiles;
  return hits.filter((hit) => isJournalEntryPhotoDropId(String(hit.id)));
}

/** Prefer photo tiles and entry photo zones when dragging photos. */
export const journalFeedCollisionDetection: CollisionDetection = (args) => {
  const activeId = String(args.active.id);

  if (isPhotoSortId(activeId)) {
    const pointer = preferPhotoTiles(pointerWithin(args).filter((hit) => isPhotoDropTarget(String(hit.id))));
    if (pointer.length) return pointer;
    const rects = preferPhotoTiles(rectIntersection(args).filter((hit) => isPhotoDropTarget(String(hit.id))));
    if (rects.length) return rects;
    return preferPhotoTiles(closestCenter(args).filter((hit) => isPhotoDropTarget(String(hit.id))));
  }

  return closestCenter(args).filter((hit) => !isPhotoSortId(String(hit.id)));
};
