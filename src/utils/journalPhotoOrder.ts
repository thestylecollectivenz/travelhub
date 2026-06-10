import type { JournalPhoto } from '../models';

export function photoOrderStorageKey(tripId: string, entryId: string): string {
  return `travelhub-photo-order-${tripId}-${entryId}`;
}

export function loadPhotoOrder(tripId: string, entryId: string): string[] | null {
  if (!tripId || !entryId) return null;
  try {
    const raw = window.localStorage.getItem(photoOrderStorageKey(tripId, entryId));
    if (!raw) return null;
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return null;
    return parsed.map((id) => String(id)).filter(Boolean);
  } catch {
    return null;
  }
}

export function savePhotoOrder(tripId: string, entryId: string, ids: string[]): void {
  if (!tripId || !entryId) return;
  try {
    window.localStorage.setItem(photoOrderStorageKey(tripId, entryId), JSON.stringify(ids));
  } catch {
    // ignore quota errors
  }
}

export function applyPhotoOrder(photos: JournalPhoto[], order: string[]): JournalPhoto[] {
  const byId = new Map(photos.map((p) => [p.id, p]));
  const ordered: JournalPhoto[] = [];
  const seen = new Set<string>();
  for (const id of order) {
    const photo = byId.get(id);
    if (photo) {
      ordered.push(photo);
      seen.add(id);
    }
  }
  for (const photo of photos) {
    if (!seen.has(photo.id)) ordered.push(photo);
  }
  return ordered;
}

/** Hydrate saved display order for each entry that has photos. */
export function mergePhotoOrdersFromStorage(tripId: string, photos: JournalPhoto[]): Record<string, string[]> {
  const result: Record<string, string[]> = {};
  if (!tripId) return result;

  const byEntry = new Map<string, JournalPhoto[]>();
  for (const photo of photos) {
    const entryId = photo.journalEntryId?.trim();
    if (!entryId) continue;
    const list = byEntry.get(entryId) ?? [];
    list.push(photo);
    byEntry.set(entryId, list);
  }

  byEntry.forEach((list, entryId) => {
    const stored = loadPhotoOrder(tripId, entryId);
    if (!stored?.length) return;
    result[entryId] = applyPhotoOrder(list, stored).map((p) => p.id);
  });

  return result;
}

export function removePhotoFromOrder(order: string[], photoId: string): string[] {
  return order.filter((id) => id !== photoId);
}

export function appendPhotoToOrder(order: string[], photoId: string): string[] {
  if (order.indexOf(photoId) >= 0) return order;
  return [...order, photoId];
}
