import type { EntryLink } from '../models';

export function sortEntryLinks(links: EntryLink[]): EntryLink[] {
  return [...links].sort((a, b) => {
    const orderDiff = (a.sortOrder ?? 0) - (b.sortOrder ?? 0);
    if (orderDiff !== 0) return orderDiff;
    return (a.linkTitle || a.url || '').localeCompare(b.linkTitle || b.url || '', undefined, {
      sensitivity: 'base'
    });
  });
}

export function entryLinkSortableId(linkId: string): string {
  return `entry-link:${linkId}`;
}

export function parseEntryLinkSortableId(id: string | number): string | undefined {
  const raw = String(id);
  const prefix = 'entry-link:';
  return raw.indexOf(prefix) === 0 ? raw.slice(prefix.length) : undefined;
}
