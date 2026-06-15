import type { EntryDocument } from '../models';
import { sortEntryDocuments } from './entryDocumentSort';

const PREFIX = 'travelHub.documentOrder';

function storageKey(tripId: string, entryId: string): string {
  return `${PREFIX}.${tripId}.${entryId}`;
}

export function readDocumentOrder(tripId: string, entryId: string): string[] {
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

export function clearDocumentOrder(tripId: string, entryId: string): void {
  try {
    window.localStorage.removeItem(storageKey(tripId, entryId));
  } catch {
    /* ignore */
  }
}

export function migrateLegacyDocumentOrder(
  tripId: string,
  documents: EntryDocument[]
): { documents: EntryDocument[]; persist: Array<{ id: string; sortOrder: number }> } {
  if (!tripId || !documents.length) return { documents, persist: [] };

  const byEntry = new Map<string, EntryDocument[]>();
  for (const doc of documents) {
    const group = byEntry.get(doc.entryId) ?? [];
    group.push(doc);
    byEntry.set(doc.entryId, group);
  }

  const updatedById = new Map<string, EntryDocument>();
  const persist: Array<{ id: string; sortOrder: number }> = [];

  Array.from(byEntry.entries()).forEach(([entryId, group]) => {
    const allUnset = group.every((d) => (d.sortOrder ?? 0) === 0);
    const legacy = readDocumentOrder(tripId, entryId);
    if (!allUnset || legacy.length === 0) {
      group.forEach((doc) => updatedById.set(doc.id, doc));
      return;
    }

    const byId = new Map(group.map((d) => [d.id, d] as [string, EntryDocument]));
    const ordered: EntryDocument[] = [];
    const used = new Set<string>();
    legacy.forEach((id, index) => {
      const doc = byId.get(id);
      if (doc) {
        const next: EntryDocument = { ...doc, sortOrder: index };
        ordered.push(next);
        updatedById.set(doc.id, next);
        persist.push({ id: doc.id, sortOrder: index });
        used.add(doc.id);
      }
    });
    group.forEach((doc) => {
      if (!used.has(doc.id)) {
        const next: EntryDocument = { ...doc, sortOrder: ordered.length };
        ordered.push(next);
        updatedById.set(doc.id, next);
        persist.push({ id: doc.id, sortOrder: next.sortOrder ?? ordered.length });
      }
    });
    clearDocumentOrder(tripId, entryId);
  });

  const merged = documents.map((d) => updatedById.get(d.id) ?? d);
  return { documents: sortEntryDocuments(merged), persist };
}
