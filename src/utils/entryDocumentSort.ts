import type { EntryDocument } from '../models';

export function sortEntryDocuments(docs: EntryDocument[]): EntryDocument[] {
  return [...docs].sort((a, b) => {
    const orderDiff = (a.sortOrder ?? 0) - (b.sortOrder ?? 0);
    if (orderDiff !== 0) return orderDiff;
    return (a.title || a.fileName || '').localeCompare(b.title || b.fileName || '', undefined, {
      sensitivity: 'base'
    });
  });
}

export function entryDocumentSortableId(docId: string): string {
  return `entry-doc:${docId}`;
}

export function parseEntryDocumentSortableId(id: string | number): string | undefined {
  const raw = String(id);
  const prefix = 'entry-doc:';
  return raw.indexOf(prefix) === 0 ? raw.slice(prefix.length) : undefined;
}
