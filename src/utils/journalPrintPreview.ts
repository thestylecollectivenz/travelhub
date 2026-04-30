import type { Trip } from '../models/Trip';
import type { TripDay } from '../models/TripDay';
import type { JournalEntry, JournalPhoto, JournalComment } from '../models';

function esc(s: string): string {
  return (s || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

/** Inline print styles for the preview window (no dependency on host CSS variables). */
const JOURNAL_PRINT_STYLES = `
body { margin: 0; font-family: system-ui, -apple-system, Segoe UI, Roboto, sans-serif; color: #0f172a; background: #fff; }
.toolbar { position: sticky; top: 0; z-index: 2; padding: 12px 16px; background: #f8fafc; border-bottom: 1px solid #e2e8f0; display: flex; gap: 8px; flex-wrap: wrap; align-items: center; }
.toolbar button { border: none; border-radius: 8px; padding: 8px 16px; background: #1a6399; color: #fff; font-weight: 600; cursor: pointer; }
.th-journal-print { padding: 16px 20px 40px; max-width: 52rem; margin: 0 auto; }
.print-front-matter { page-break-inside: avoid; page-break-after: always; }
.print-cover-page { display: grid; grid-template-rows: auto 1fr; page-break-after: avoid; min-height: auto; }
.print-cover-hero { width: 100%; max-height: 11rem; object-fit: cover; object-position: center; }
.print-cover-content { display: grid; gap: 8px; justify-items: center; text-align: center; padding: 12px 16px; }
.print-cover-summary { margin-top: 12px; width: min(36rem, 100%); border: 1px solid #e2e8f0; border-radius: 12px; overflow: hidden; }
.print-cover-summary > div { display: grid; grid-template-columns: 1fr auto; gap: 8px; padding: 8px 12px; border-bottom: 1px solid #e2e8f0; }
.print-cover-summary > div:last-child { border-bottom: none; }
.print-day-block { page-break-before: auto; }
.print-day-block.print-day-first { page-break-before: always; }
.print-day-section { margin-top: 1.5rem; padding-top: 0.75rem; border-top: 1px solid #ddd; }
.print-day-heading { margin-bottom: 0.75rem; font-size: 1.35rem; page-break-after: avoid; }
.print-entry { margin-bottom: 1.5rem; }
.print-entry-meta { margin-bottom: 0.5rem; color: #64748b; font-size: 0.85rem; }
.photoGrid { display: grid; gap: 8px; }
.photoHeavy { grid-template-columns: repeat(2, 1fr); }
.textHeavy { grid-template-columns: repeat(4, 1fr); }
.photoGrid img { max-width: 100%; height: auto; object-fit: contain; }
.photoHeavy img { max-height: 24rem; }
.textHeavy img { max-height: 8rem; }
@media print {
  .toolbar { display: none !important; }
  .th-journal-print { padding: 0; max-width: none; }
  .th-journal-print h1, .th-journal-print h2, .th-journal-print h3 { page-break-after: avoid; }
  .th-journal-print.dayPageBreaks .print-day-block + .print-day-block { page-break-before: always; }
}
`;

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
  layout: 'photo' | 'text';
  oneDayPerPage: boolean;
}

export function openJournalPrintPreview(params: JournalPrintPreviewParams): void {
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
    layout,
    oneDayPerPage
  } = params;

  const printableDays = [...tripDays]
    .sort((a, b) => a.dayNumber - b.dayNumber)
    .filter((d) => (includePreTrip ? true : d.dayType !== 'PreTrip'));

  const rawHero = includeHeroOnCover && trip.heroImageUrl?.trim() ? trip.heroImageUrl.trim() : '';
  const coverHeroAttr = rawHero.replace(/"/g, '&quot;');

  let body = '';
  if (showCover) {
    body += `<div class="print-front-matter"><div class="print-cover-page ${rawHero ? 'hasHero' : 'noHero'}">`;
    if (rawHero) {
      body += `<img class="print-cover-hero" src="${coverHeroAttr}" alt="" />`;
    }
    body += `<div class="print-cover-content"><h1>${esc(trip.title)}</h1><p>${esc(trip.destination)}</p><p>${esc(trip.dateStart)} to ${esc(trip.dateEnd)}</p></div></div>`;
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
    const dayTitle = day.dayType === 'PreTrip' ? 'Pre-trip' : `Day ${day.dayNumber} — ${esc(day.displayTitle)}`;
    const firstClass = !showCover && idx === 0 ? ' print-day-first' : showCover && idx === 0 ? ' print-day-first' : '';
    body += `<div class="print-day-block${firstClass}"><section class="print-day-section"><h2 class="print-day-heading">${dayTitle}</h2>`;
    if (day.dayType !== 'PreTrip') {
      body += `<p class="print-entry-meta">${esc(day.calendarDate)}</p>`;
    }
    for (const entry of dayEntries) {
      const entryPhotos = photos.filter((p) => p.journalEntryId === entry.id || (!p.journalEntryId && p.dayId === day.id));
      const comments = commentsForEntry(entry.id);
      const locPrefix = entry.location ? `${esc(entry.location)} — ` : '';
      body += `<article class="print-entry"><h3>${locPrefix}${esc(new Date(entry.entryTimestamp).toLocaleString('en-NZ'))}</h3>`;
      body += `<div class="print-entry-meta">${esc(entry.authorName || '')}</div>`;
      body += `<div class="print-entry-body">${entry.entryText || ''}</div>`;
      if (includeLikes) {
        body += `<div>Likes: ${entry.likeCount}</div>`;
      }
      if (entryPhotos.length) {
        body += `<div class="photoGrid ${layout === 'photo' ? 'photoHeavy' : 'textHeavy'}">`;
        for (const p of entryPhotos) {
          body += `<figure style="margin:0"><img src="${esc(p.fileUrl)}" alt="${esc(p.caption || 'Journal photo')}" />`;
          if (p.caption) body += `<figcaption style="font-size:11px">${esc(p.caption)}</figcaption>`;
          body += `</figure>`;
        }
        body += `</div>`;
      }
      if (includeComments && comments.length) {
        body += `<div style="margin-top:8px">`;
        for (const c of comments) {
          body += `<blockquote style="margin:6px 0;font-size:12px">${esc(c.authorName)}: ${esc(c.commentText)}</blockquote>`;
        }
        body += `</div>`;
      }
      body += `</article>`;
    }
    body += `</section></div>`;
  });

  const dayBreakClass = oneDayPerPage ? 'dayPageBreaks' : '';
  const doc = `<!DOCTYPE html><html><head><meta charset="utf-8"/><title>${esc(trip.title)} — Journal</title><style>${JOURNAL_PRINT_STYLES}</style></head><body>
<div class="toolbar"><button type="button" id="th-print-btn">Print / Save PDF</button></div>
<div class="th-journal-print printRoot ${dayBreakClass}">${body}</div>
<script>
document.getElementById('th-print-btn').addEventListener('click', function () { window.focus(); window.print(); });
</script></body></html>`;

  const previewWindow = window.open('', '_blank', 'width=900,height=700,scrollbars=yes');
  if (!previewWindow) {
    // eslint-disable-next-line no-console
    console.warn('Journal print preview blocked by popup blocker');
    return;
  }
  previewWindow.document.open();
  previewWindow.document.write(doc);
  previewWindow.document.close();
}
