import type { Trip } from '../models/Trip';
import type { TripDay } from '../models/TripDay';
import type { JournalEntry, JournalPhoto, JournalComment } from '../models';
import { compareJournalPhotos } from './compareJournalPhotos';
import { formatOrdinalDayDate, formatOrdinalDateRange } from './formatTripDayDate';
import { formatJournalDayTitle } from './formatDayHeadingLabel';

function esc(s: string): string {
  return (s || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function buildJournalPrintStyles(oneDayPerPage: boolean): string {
  const coverBreak = oneDayPerPage
    ? `.print-root.one-day-per-page .print-front-matter { page-break-after: always; }
.print-root.one-day-per-page .print-day-block.print-day-first { page-break-before: always; }
.print-root.one-day-per-page .print-day-block + .print-day-block { page-break-before: always; }`
    : `.print-root .print-front-matter { page-break-after: auto; }
.print-root .print-day-block { page-break-before: auto; }`;

  return `
@page { size: portrait; margin: 2.2cm 1.9cm 2.9cm 1.9cm; }
body { margin: 0; font-family: system-ui, -apple-system, Segoe UI, Roboto, sans-serif; color: #0f172a; background: #fff; }
.th-journal-print { padding: 16px 20px 48px; max-width: 46rem; margin: 0 auto; }
.print-doc-footer {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 12px;
  margin-top: 24px;
  padding-top: 8px;
  border-top: 1px solid #e2e8f0;
  font-size: 8.5pt;
  color: #64748b;
}
.print-footer-url { flex: 1 1 auto; text-align: left; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; max-width: 78%; }
.print-footer-page { flex: 0 0 auto; text-align: right; }
.print-front-matter { page-break-inside: avoid; margin-bottom: 0.5rem; }
.print-cover-page { display: grid; grid-template-rows: auto auto; page-break-after: avoid; min-height: auto; }
.print-cover-hero { width: 100%; max-height: 9rem; object-fit: cover; object-position: center; }
.print-cover-content { display: grid; gap: 4px; justify-items: center; text-align: center; padding: 8px 16px 4px; }
.print-cover-content h1 { margin: 0; font-size: 1.75rem; line-height: 1.2; }
.print-cover-content p { margin: 0; line-height: 1.35; }
.print-cover-summary { margin-top: 8px; width: min(36rem, 100%); border: 1px solid #e2e8f0; border-radius: 12px; overflow: hidden; }
.print-cover-summary > div { display: grid; grid-template-columns: 1fr auto; gap: 8px; padding: 8px 12px; border-bottom: 1px solid #e2e8f0; }
.print-cover-summary > div:last-child { border-bottom: none; }
.print-day-block { page-break-inside: auto; }
.print-page-header {
  display: flex;
  justify-content: space-between;
  align-items: baseline;
  gap: 16px;
  font-size: 10pt;
  margin: 0 0 10px;
  padding: 0 0 6px;
  border-bottom: 1px solid #e2e8f0;
}
.print-header-trip { text-align: left; font-weight: 600; flex: 1 1 auto; min-width: 0; }
.print-header-day { text-align: right; font-weight: 500; font-size: 9.5pt; color: #475569; flex: 0 1 48%; min-width: 0; }
.print-day-section { margin-top: 0; padding-top: 0; border-top: none; }
.print-root.has-cover .print-day-block:first-of-type { margin-top: 0.75rem; }
.print-root:not(.has-cover) .print-day-block:first-of-type { margin-top: 0; }
.print-day-block + .print-day-block { margin-top: 1.25rem; padding-top: 0.75rem; border-top: 1px solid #ddd; }
.print-day-heading { margin-bottom: 0.75rem; font-size: 1.35rem; page-break-after: avoid; }
.print-entry { margin-bottom: 1.5rem; }
.print-entry-meta { margin-bottom: 0.5rem; color: #64748b; font-size: 0.85rem; text-align: left; }
.print-entry-heading { margin: 0 0 0.35rem; font-size: 1rem; text-align: left; }
.print-entry-body { text-align: left; }
.photoGrid { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 10px; margin-top: 0.75rem; }
.photoGrid figure { margin: 0; display: flex; flex-direction: column; gap: 4px; }
.photoGrid img { width: 100%; aspect-ratio: 1; object-fit: cover; display: block; border-radius: 4px; }
.photoGrid figcaption { font-size: 11px; color: #475569; margin: 0; text-align: left; }
.print-album-photos { margin-top: 1rem; }
.print-album-heading { font-size: 1rem; color: #475569; margin: 0 0 0.5rem; text-align: left; }
${coverBreak}
@media print {
  .th-journal-print { padding: 0 0 1.4cm; max-width: none; }
  .th-journal-print h1, .th-journal-print h2, .th-journal-print h3 { page-break-after: avoid; }
  .print-doc-footer {
    position: fixed;
    bottom: 0;
    left: 0;
    right: 0;
    margin: 0;
    padding: 6px 0 0;
    background: #fff;
  }
  .print-footer-page::after { content: counter(page) " / " counter(pages); }
}
`;
}

export interface JournalPrintPreviewParams {
  trip: Trip;
  tripDays: TripDay[];
  entries: JournalEntry[];
  photos: JournalPhoto[];
  commentsForEntry: (entryId: string) => JournalComment[];
  showCover: boolean;
  includeHeroOnCover: boolean;
  showSummary: boolean;
  includePreTrip: boolean;
  includeComments: boolean;
  includeLikes: boolean;
  includePhotoCaptions: boolean;
  includeEntryTimestamps: boolean;
  includeAuthorNames: boolean;
  oneDayPerPage: boolean;
  /** Page URL shown in the document footer (browser headers should stay off). */
  sourceUrl?: string;
}

function renderPhotoGrid(items: JournalPhoto[], includePhotoCaptions: boolean): string {
  if (!items.length) return '';
  const sorted = [...items].sort(compareJournalPhotos);
  let html = `<div class="photoGrid">`;
  for (const p of sorted) {
    html += `<figure><img src="${esc(p.fileUrl)}" alt="${esc(p.caption?.trim() ? p.caption : 'Journal photo')}" />`;
    if (includePhotoCaptions && p.caption?.trim()) {
      html += `<figcaption>${esc(p.caption.trim())}</figcaption>`;
    }
    html += `</figure>`;
  }
  html += `</div>`;
  return html;
}

export function buildJournalPrintDocument(params: JournalPrintPreviewParams): string {
  const {
    trip,
    tripDays,
    entries,
    photos,
    commentsForEntry,
    showCover,
    includeHeroOnCover,
    showSummary,
    includePreTrip,
    includeComments,
    includeLikes,
    includePhotoCaptions,
    includeEntryTimestamps,
    includeAuthorNames,
    oneDayPerPage,
    sourceUrl = ''
  } = params;

  const showEntryTimestamps = includeEntryTimestamps && trip.showJournalEntryDate !== false;
  const showAuthorNames = includeAuthorNames && trip.showAuthorName !== false;

  const printableDays = [...tripDays]
    .sort((a, b) => a.dayNumber - b.dayNumber)
    .filter((d) => (includePreTrip ? true : d.dayType !== 'PreTrip'));

  const rawHero = includeHeroOnCover && trip.heroImageUrl?.trim() ? trip.heroImageUrl.trim() : '';
  const coverHeroAttr = rawHero.replace(/"/g, '&quot;');
  const tripHeaderLabel = `${trip.title} — Journal`;

  let body = '';
  if (showCover) {
    body += `<div class="print-front-matter"><div class="print-cover-page ${rawHero ? 'hasHero' : 'noHero'}">`;
    if (rawHero) {
      body += `<img class="print-cover-hero" src="${coverHeroAttr}" alt="" />`;
    }
    body += `<div class="print-cover-content"><h1>${esc(trip.title)}</h1><p>${esc(trip.destination)}</p><p>${esc(formatOrdinalDateRange(trip.dateStart, trip.dateEnd))}</p></div></div>`;
    if (showSummary) {
      body += `<div class="print-cover-summary">`;
      body += `<div><strong>Total days</strong><span>${printableDays.length}</span></div>`;
      body += `<div><strong>Journal entries</strong><span>${entries.length}</span></div>`;
      body += `<div><strong>Photos</strong><span>${photos.length}</span></div>`;
      body += `<div><strong>Budget</strong><span>Not included in journal export</span></div>`;
      body += `</div>`;
    }
    body += `</div>`;
  }

  printableDays.forEach((day, idx) => {
    const dayEntries = entries
      .filter((e) => e.dayId === day.id)
      .sort((a, b) => a.entryTimestamp.localeCompare(b.entryTimestamp));
    const dayTitle = esc(formatJournalDayTitle(day));
    const firstClass = oneDayPerPage && idx === 0 ? ' print-day-first' : '';
    body += `<div class="print-day-block${firstClass}">`;
    body += `<div class="print-page-header"><span class="print-header-trip">${esc(tripHeaderLabel)}</span><span class="print-header-day">${dayTitle}</span></div>`;
    body += `<section class="print-day-section"><h2 class="print-day-heading">${dayTitle}</h2>`;
    if (day.dayType !== 'PreTrip') {
      body += `<p class="print-entry-meta">${esc(formatOrdinalDayDate(day.calendarDate))}</p>`;
    }
    for (const entry of dayEntries) {
      const entryPhotos = photos.filter((p) => p.journalEntryId === entry.id);
      const comments = commentsForEntry(entry.id);
      const locLine = entry.location?.trim() ? `<div class="print-entry-meta">📍 ${esc(entry.location)}</div>` : '';
      const authorLine =
        showAuthorNames && entry.authorName?.trim()
          ? `<div class="print-entry-meta">${esc(entry.authorName)}</div>`
          : '';
      const tsLine = showEntryTimestamps
        ? `<div class="print-entry-meta">${esc(new Date(entry.entryTimestamp).toLocaleString('en-NZ'))}</div>`
        : '';
      body += `<article class="print-entry">${authorLine}${tsLine}`;
      body += locLine;
      body += `<div class="print-entry-body">${entry.entryText || ''}</div>`;
      if (includeLikes) {
        body += `<div class="print-entry-meta">Likes: ${entry.likeCount}</div>`;
      }
      body += renderPhotoGrid(entryPhotos, includePhotoCaptions);
      if (includeComments && comments.length) {
        body += `<div style="margin-top:8px">`;
        for (const c of comments) {
          body += `<blockquote style="margin:6px 0;font-size:12px">${esc(c.authorName)}: ${esc(c.commentText)}</blockquote>`;
        }
        body += `</div>`;
      }
      body += `</article>`;
    }

    const orphanPhotos = photos.filter((p) => p.dayId === day.id && !p.journalEntryId?.trim());
    if (orphanPhotos.length) {
      body += `<div class="print-album-photos"><h4 class="print-album-heading">Album photos (not linked to an entry)</h4>`;
      body += renderPhotoGrid(orphanPhotos, includePhotoCaptions);
      body += `</div>`;
    }

    body += `</section></div>`;
  });

  const rootClass = `print-root th-journal-print${showCover ? ' has-cover' : ''}${oneDayPerPage ? ' one-day-per-page' : ''}`;
  const styles = buildJournalPrintStyles(oneDayPerPage);
  const footerUrl = esc(sourceUrl.trim());
  const footer = footerUrl
    ? `<footer class="print-doc-footer"><span class="print-footer-url">${footerUrl}</span><span class="print-footer-page" aria-hidden="true"></span></footer>`
    : `<footer class="print-doc-footer"><span class="print-footer-url"></span><span class="print-footer-page" aria-hidden="true"></span></footer>`;
  return `<!DOCTYPE html><html><head><meta charset="utf-8"/><title> </title><style>${styles}</style></head><body><div class="${rootClass}">${body}</div>${footer}</body></html>`;
}
