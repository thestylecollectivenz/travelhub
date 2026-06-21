import type { EntryDocument, EntryLink } from '../models';
import { entryDocumentSortableId, parseEntryDocumentSortableId } from './entryDocumentSort';
import { entryLinkSortableId, parseEntryLinkSortableId } from './entryLinkSort';

export type EntryAttachmentRow =
  | { kind: 'doc'; item: EntryDocument }
  | { kind: 'link'; item: EntryLink };

export type EntryAttachmentOrderItem = { kind: 'doc'; id: string } | { kind: 'link'; id: string };

export function mergeEntryAttachments(docs: EntryDocument[], links: EntryLink[]): EntryAttachmentRow[] {
  const rows: Array<{ sortOrder: number; kind: 'doc' | 'link'; item: EntryDocument | EntryLink }> = [];
  docs.forEach((doc) => rows.push({ sortOrder: doc.sortOrder ?? 0, kind: 'doc', item: doc }));
  links.forEach((link) => rows.push({ sortOrder: link.sortOrder ?? 0, kind: 'link', item: link }));
  rows.sort((a, b) => {
    const orderDiff = a.sortOrder - b.sortOrder;
    if (orderDiff !== 0) return orderDiff;
    if (a.kind !== b.kind) return a.kind === 'doc' ? -1 : 1;
    const aLabel =
      a.kind === 'doc'
        ? (a.item as EntryDocument).title || (a.item as EntryDocument).fileName || ''
        : (a.item as EntryLink).linkTitle || (a.item as EntryLink).url || '';
    const bLabel =
      b.kind === 'doc'
        ? (b.item as EntryDocument).title || (b.item as EntryDocument).fileName || ''
        : (b.item as EntryLink).linkTitle || (b.item as EntryLink).url || '';
    return aLabel.localeCompare(bLabel, undefined, { sensitivity: 'base' });
  });
  return rows.map((row) =>
    row.kind === 'doc'
      ? { kind: 'doc' as const, item: row.item as EntryDocument }
      : { kind: 'link' as const, item: row.item as EntryLink }
  );
}

export function entryAttachmentSortableId(row: EntryAttachmentOrderItem): string {
  return row.kind === 'doc' ? entryDocumentSortableId(row.id) : entryLinkSortableId(row.id);
}

export function parseEntryAttachmentSortableId(
  id: string | number
): EntryAttachmentOrderItem | undefined {
  const docId = parseEntryDocumentSortableId(id);
  if (docId) return { kind: 'doc', id: docId };
  const linkId = parseEntryLinkSortableId(id);
  if (linkId) return { kind: 'link', id: linkId };
  return undefined;
}
