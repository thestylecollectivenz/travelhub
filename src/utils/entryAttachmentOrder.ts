import type { EntryDocument, EntryLink } from '../models';
import type { EntryAttachmentOrderItem } from './entryAttachmentSort';

const PREFIX = 'travelHub.attachmentOrder';

function storageKey(tripId: string, entryId: string): string {
  return `${PREFIX}.${tripId}.${entryId}`;
}

export function readAttachmentOrder(tripId: string, entryId: string): EntryAttachmentOrderItem[] {
  if (!tripId || !entryId) return [];
  try {
    const raw = window.localStorage.getItem(storageKey(tripId, entryId));
    if (!raw) return [];
    const parsed = JSON.parse(raw) as EntryAttachmentOrderItem[];
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(
      (item) =>
        item &&
        (item.kind === 'doc' || item.kind === 'link') &&
        typeof item.id === 'string' &&
        item.id.length > 0
    );
  } catch {
    return [];
  }
}

export function writeAttachmentOrder(
  tripId: string,
  entryId: string,
  ordered: EntryAttachmentOrderItem[]
): void {
  if (!tripId || !entryId) return;
  try {
    window.localStorage.setItem(storageKey(tripId, entryId), JSON.stringify(ordered));
  } catch {
    /* ignore */
  }
}

export function clearAttachmentOrder(tripId: string, entryId: string): void {
  try {
    window.localStorage.removeItem(storageKey(tripId, entryId));
  } catch {
    /* ignore */
  }
}

/** Apply stored mixed doc/link order and return SharePoint sortOrder updates to persist. */
export function migrateMixedAttachmentOrder(
  tripId: string,
  documents: EntryDocument[],
  links: EntryLink[]
): {
  documents: EntryDocument[];
  links: EntryLink[];
  persist: Array<{ kind: 'doc' | 'link'; id: string; sortOrder: number }>;
} {
  if (!tripId) return { documents, links, persist: [] };

  const byEntry = new Map<string, { docs: EntryDocument[]; links: EntryLink[] }>();
  for (const doc of documents) {
    const group = byEntry.get(doc.entryId) ?? { docs: [], links: [] };
    group.docs.push(doc);
    byEntry.set(doc.entryId, group);
  }
  for (const link of links) {
    const group = byEntry.get(link.entryId) ?? { docs: [], links: [] };
    group.links.push(link);
    byEntry.set(link.entryId, group);
  }

  const docById = new Map(documents.map((d) => [d.id, d] as const));
  const linkById = new Map(links.map((l) => [l.id, l] as const));
  const persist: Array<{ kind: 'doc' | 'link'; id: string; sortOrder: number }> = [];

  Array.from(byEntry.entries()).forEach(([entryId, group]) => {
    const stored = readAttachmentOrder(tripId, entryId);
    if (!stored.length) return;

    const docIds = new Set(group.docs.map((d) => d.id));
    const linkIds = new Set(group.links.map((l) => l.id));
    const ordered: EntryAttachmentOrderItem[] = [];
    const used = new Set<string>();

    stored.forEach((item) => {
      const key = `${item.kind}:${item.id}`;
      if (used.has(key)) return;
      if (item.kind === 'doc' && docIds.has(item.id)) {
        ordered.push(item);
        used.add(key);
      }
      if (item.kind === 'link' && linkIds.has(item.id)) {
        ordered.push(item);
        used.add(key);
      }
    });

    group.docs.forEach((d) => {
      if (!used.has(`doc:${d.id}`)) ordered.push({ kind: 'doc', id: d.id });
    });
    group.links.forEach((l) => {
      if (!used.has(`link:${l.id}`)) ordered.push({ kind: 'link', id: l.id });
    });

    ordered.forEach((item, index) => {
      persist.push({ kind: item.kind, id: item.id, sortOrder: index });
      if (item.kind === 'doc') {
        const prev = docById.get(item.id);
        if (prev) docById.set(item.id, { ...prev, sortOrder: index });
      } else {
        const prev = linkById.get(item.id);
        if (prev) linkById.set(item.id, { ...prev, sortOrder: index });
      }
    });
  });

  return {
    documents: documents.map((d) => docById.get(d.id) ?? d),
    links: links.map((l) => linkById.get(l.id) ?? l),
    persist
  };
}
