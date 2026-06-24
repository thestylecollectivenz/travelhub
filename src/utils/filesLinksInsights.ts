import type { EntryDocument, EntryLink } from '../models';

function normalizeUrl(url: string): string {
  return url.trim().toLowerCase().replace(/\/$/, '');
}

export interface FilesLinksInsight {
  duplicateUrls: Array<{ url: string; titles: string[] }>;
  unlinkedDocuments: number;
  unlinkedLinks: number;
  missingEntryLinks: number;
}

export function buildFilesLinksInsights(documents: EntryDocument[], links: EntryLink[]): FilesLinksInsight {
  const urlGroups = new Map<string, string[]>();
  for (const l of links) {
    const key = normalizeUrl(l.url);
    if (!key) continue;
    const titles = urlGroups.get(key) ?? [];
    titles.push(l.linkTitle || l.url);
    urlGroups.set(key, titles);
  }

  const duplicateUrls = Array.from(urlGroups.entries())
    .filter(([, titles]) => titles.length > 1)
    .map(([url, titles]) => ({ url, titles }));

  const unlinkedDocuments = documents.filter((d) => !d.entryId?.trim()).length;
  const unlinkedLinks = links.filter((l) => !l.entryId?.trim()).length;
  const missingEntryLinks = documents.filter((d) => !d.dayId?.trim()).length + links.filter((l) => !l.dayId?.trim()).length;

  return { duplicateUrls, unlinkedDocuments, unlinkedLinks, missingEntryLinks };
}
