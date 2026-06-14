import type { EntryLink } from '../models';
import { sortEntryLinks } from './entryLinkSort';

const PREFIX = 'travelHub.linkOrder';

function storageKey(tripId: string, entryId: string): string {
  return `${PREFIX}.${tripId}.${entryId}`;
}

export function readLinkOrder(tripId: string, entryId: string): string[] {
  if (!tripId || !entryId) return [];
  try {
    const raw = window.localStorage.getItem(storageKey(tripId, entryId));
    if (!raw) return [];
    const ids = JSON.parse(raw) as string[];
    return Array.isArray(ids) ? ids : [];
  } catch {
    return [];
  }
}

export function clearLinkOrder(tripId: string, entryId: string): void {
  try {
    window.localStorage.removeItem(storageKey(tripId, entryId));
  } catch {
    /* ignore */
  }
}

/** One-time migration from legacy browser order when SharePoint SortOrder is unset. */
export function migrateLegacyLinkOrder(
  tripId: string,
  links: EntryLink[]
): { links: EntryLink[]; persist: Array<{ id: string; sortOrder: number }> } {
  if (!tripId || !links.length) return { links, persist: [] };

  const byEntry = new Map<string, EntryLink[]>();
  for (const link of links) {
    const group = byEntry.get(link.entryId) ?? [];
    group.push(link);
    byEntry.set(link.entryId, group);
  }

  const updatedById = new Map<string, EntryLink>();
  const persist: Array<{ id: string; sortOrder: number }> = [];

  Array.from(byEntry.entries()).forEach(([entryId, group]) => {
    const allUnset = group.every((l) => (l.sortOrder ?? 0) === 0);
    const legacy = readLinkOrder(tripId, entryId);
    if (!allUnset || legacy.length === 0) {
      group.forEach((link) => updatedById.set(link.id, link));
      return;
    }

    const byId = new Map(group.map((l) => [l.id, l] as [string, EntryLink]));
    const ordered: EntryLink[] = [];
    const used = new Set<string>();
    legacy.forEach((id, index) => {
      const link = byId.get(id);
      if (link) {
        const next: EntryLink = { ...link, sortOrder: index };
        ordered.push(next);
        updatedById.set(link.id, next);
        persist.push({ id: link.id, sortOrder: index });
        used.add(link.id);
      }
    });
    group.forEach((link) => {
      if (!used.has(link.id)) {
        const next: EntryLink = { ...link, sortOrder: ordered.length };
        ordered.push(next);
        updatedById.set(link.id, next);
        persist.push({ id: link.id, sortOrder: next.sortOrder ?? ordered.length });
      }
    });
    clearLinkOrder(tripId, entryId);
  });

  const merged = links.map((l) => updatedById.get(l.id) ?? l);
  return { links: sortEntryLinks(merged), persist };
}
