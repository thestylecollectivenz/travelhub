import type { EntryDocument, EntryLink } from '../models';

function normalizeUrl(url: string): string {
  return url.trim().toLowerCase().replace(/\/$/, '');
}

export interface FilesLinksInsight {
  duplicateUrls: Array<{ url: string; titles: string[]; linkIds: string[] }>;
  unlinkedDocuments: number;
  unlinkedLinks: number;
  missingEntryLinks: number;
  unlinkedDocumentIds: string[];
  unlinkedLinkIds: string[];
  missingDayDocumentIds: string[];
  missingDayLinkIds: string[];
  duplicateLinkIds: string[];
}

export function buildFilesLinksInsights(documents: EntryDocument[], links: EntryLink[]): FilesLinksInsight {
  const urlGroups = new Map<string, { titles: string[]; linkIds: string[] }>();
  for (const l of links) {
    const key = normalizeUrl(l.url);
    if (!key) continue;
    const row = urlGroups.get(key) ?? { titles: [], linkIds: [] };
    row.titles.push(l.linkTitle || l.url);
    row.linkIds.push(l.id);
    urlGroups.set(key, row);
  }

  const duplicateUrls = Array.from(urlGroups.entries())
    .filter(([, row]) => row.titles.length > 1)
    .map(([url, row]) => ({ url, titles: row.titles, linkIds: row.linkIds }));

  const duplicateLinkIds: string[] = [];
  for (const dup of duplicateUrls) {
    for (const id of dup.linkIds) {
      if (duplicateLinkIds.indexOf(id) < 0) duplicateLinkIds.push(id);
    }
  }

  const unlinkedDocumentIds = documents.filter((d) => !d.entryId?.trim()).map((d) => d.id);
  const unlinkedLinkIds = links.filter((l) => !l.entryId?.trim()).map((l) => l.id);
  const missingDayDocumentIds = documents.filter((d) => !d.dayId?.trim()).map((d) => d.id);
  const missingDayLinkIds = links.filter((l) => !l.dayId?.trim()).map((l) => l.id);

  return {
    duplicateUrls,
    unlinkedDocuments: unlinkedDocumentIds.length,
    unlinkedLinks: unlinkedLinkIds.length,
    missingEntryLinks: missingDayDocumentIds.length + missingDayLinkIds.length,
    unlinkedDocumentIds,
    unlinkedLinkIds,
    missingDayDocumentIds,
    missingDayLinkIds,
    duplicateLinkIds
  };
}
