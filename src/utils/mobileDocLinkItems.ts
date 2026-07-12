import type { EntryDocument } from '../models/EntryDocument';
import type { EntryLink } from '../models/EntryLink';
import { placeQueryMapsUrl, placeWebsiteSearchUrl } from './googleMapsLink';

export interface MobileDocLinkItem {
  id: string;
  label: string;
  href: string;
  kind: 'document' | 'link';
}

export function buildMobileDocLinkItems(
  docs: EntryDocument[],
  links: EntryLink[],
  options?: { placeName?: string; placeAddress?: string; notesText?: string }
): MobileDocLinkItem[] {
  const items: MobileDocLinkItem[] = [];
  const seen = new Set<string>();

  const push = (item: MobileDocLinkItem): void => {
    const key = `${item.kind}:${item.href}`;
    if (!item.href || seen.has(key)) return;
    seen.add(key);
    items.push(item);
  };

  for (const d of docs) {
    push({
      id: `doc-${d.id}`,
      label: d.title || d.fileName || 'Document',
      href: d.fileUrl,
      kind: 'document'
    });
  }
  for (const l of links) {
    push({
      id: `link-${l.id}`,
      label: l.linkTitle || l.title || l.url,
      href: l.url,
      kind: 'link'
    });
  }

  const name = (options?.placeName || '').trim();
  const address = (options?.placeAddress || '').trim();
  const maps = placeQueryMapsUrl(name, address);
  const website = placeWebsiteSearchUrl(name, address);
  if (maps) push({ id: 'maps', label: 'Map', href: maps, kind: 'link' });
  if (website) push({ id: 'website', label: 'Website', href: website, kind: 'link' });

  const notes = (options?.notesText || '').trim();
  if (notes) {
    const mapMatch = notes.match(/Maps:\s*(https?:\/\/\S+)/i);
    if (mapMatch) push({ id: 'notes-maps', label: 'Maps link', href: mapMatch[1], kind: 'link' });
    const webMatch = notes.match(/Website:\s*(https?:\/\/\S+)/i);
    if (webMatch) push({ id: 'notes-web', label: 'Website', href: webMatch[1], kind: 'link' });
  }

  return items;
}
