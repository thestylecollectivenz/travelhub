import {
  closestCenter,
  pointerWithin,
  rectIntersection,
  type CollisionDetection
} from '@dnd-kit/core';
import { isPhotoSortId } from './journalPhotoSortId';

function photoHits(
  hits: ReturnType<typeof pointerWithin>,
  activeEntryId: string | undefined
): ReturnType<typeof pointerWithin> {
  return hits.filter((hit) => {
    const id = String(hit.id);
    if (!isPhotoSortId(id)) return false;
    const hitEntryId = hit.data?.current?.entryId as string | undefined;
    if (activeEntryId && hitEntryId && hitEntryId !== activeEntryId) return false;
    return true;
  });
}

/** Prefer photo tiles when dragging photos; exclude photo tiles when dragging journal entries. */
export const journalFeedCollisionDetection: CollisionDetection = (args) => {
  const activeId = String(args.active.id);

  if (isPhotoSortId(activeId)) {
    const activeEntryId = args.active.data.current?.entryId as string | undefined;
    const pointer = photoHits(pointerWithin(args), activeEntryId);
    if (pointer.length) return pointer;
    const rects = photoHits(rectIntersection(args), activeEntryId);
    if (rects.length) return rects;
    return photoHits(closestCenter(args), activeEntryId);
  }

  return closestCenter(args).filter((hit) => !isPhotoSortId(String(hit.id)));
};
