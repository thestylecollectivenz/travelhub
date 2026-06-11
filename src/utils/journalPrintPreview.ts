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

export type JournalExportFontSize = 'small' | 'medium' | 'large';

const FONT_SIZE_PX: Record<JournalExportFontSize, number> = {
  small: 14,
  medium: 16,
  large: 18
};

/** Printable area inside @page margins (mm). */
const COVER_PAGE_WIDTH_MM = 172;
const COVER_PAGE_HEIGHT_MM = 253;
/** Below this effective DPI, hero is centred with contain instead of full-page cover. */
const COVER_HERO_MIN_DPI = 150;
const COVER_OVERLAY_HEIGHT_MM = Math.round(COVER_PAGE_HEIGHT_MM * 0.33);

export function heroFillsPrintPage(naturalWidth: number, naturalHeight: number): boolean {
  if (!naturalWidth || !naturalHeight) return true;
  const needW = Math.round((COVER_PAGE_WIDTH_MM / 25.4) * COVER_HERO_MIN_DPI);
  const needH = Math.round((COVER_PAGE_HEIGHT_MM / 25.4) * COVER_HERO_MIN_DPI);
  return Math.max(needW / naturalWidth, needH / naturalHeight) <= 1;
}

/** Lock cover layout for browser print — img object-fit is unreliable; use background-image. */
export function prepareJournalCoverForPrint(doc: Document): void {
  const stage = doc.querySelector<HTMLElement>('.print-cover-hero-stage.hasHero');
  if (!stage) return;

  const img = stage.querySelector<HTMLImageElement>('.print-cover-hero-full');
  const fillsPage = img ? heroFillsPrintPage(img.naturalWidth, img.naturalHeight) : true;
  const bgSize = fillsPage ? 'cover' : 'contain';
  const heroUrl = img?.currentSrc || img?.src || stage.dataset.heroSrc || '';

  stage.classList.remove('hero-fills-page', 'hero-centered');
  stage.classList.add(fillsPage ? 'hero-fills-page' : 'hero-centered');

  stage.style.position = 'relative';
  stage.style.display = 'block';
  stage.style.width = '100%';
  stage.style.height = `${COVER_PAGE_HEIGHT_MM}mm`;
  stage.style.minHeight = `${COVER_PAGE_HEIGHT_MM}mm`;
  stage.style.maxHeight = `${COVER_PAGE_HEIGHT_MM}mm`;
  stage.style.overflow = 'hidden';
  stage.style.pageBreakAfter = 'always';
  stage.style.breakAfter = 'page';
  stage.style.backgroundColor = '#0f172a';
  if (heroUrl) {
    stage.style.backgroundImage = `url("${heroUrl.replace(/"/g, '%22')}")`;
    stage.style.backgroundRepeat = 'no-repeat';
    stage.style.backgroundPosition = 'center center';
    stage.style.backgroundSize = bgSize;
  }
  stage.style.setProperty('-webkit-print-color-adjust', 'exact');
  stage.style.setProperty('print-color-adjust', 'exact');

  if (img) {
    img.style.display = 'none';
  }

  const overlay = stage.querySelector<HTMLElement>('.print-cover-overlay');
  if (overlay) {
    overlay.style.position = 'absolute';
    overlay.style.top = '0';
    overlay.style.left = '0';
    overlay.style.right = '0';
    overlay.style.height = `${COVER_OVERLAY_HEIGHT_MM}mm`;
    overlay.style.zIndex = '2';
    overlay.style.display = 'flex';
    overlay.style.alignItems = 'center';
    overlay.style.justifyContent = 'center';
    overlay.style.padding = '1.25rem 1.5rem';
    overlay.style.textAlign = 'center';
    overlay.style.boxSizing = 'border-box';
    overlay.style.background =
      'linear-gradient(180deg, rgba(15, 23, 42, 0.62) 0%, rgba(15, 23, 42, 0.3) 55%, transparent 100%)';
    overlay.style.setProperty('-webkit-print-color-adjust', 'exact');
    overlay.style.setProperty('print-color-adjust', 'exact');
  }

  stage.querySelectorAll<HTMLElement>('.print-cover-overlay .print-cover-content h1').forEach((el) => {
    el.style.margin = '0';
    el.style.color = '#ffffff';
    el.style.fontSize = '1.85rem';
    el.style.lineHeight = '1.15';
    el.style.fontWeight = '700';
    el.style.textShadow = '0 1px 4px rgba(0, 0, 0, 0.75)';
  });

  stage.querySelectorAll<HTMLElement>('.print-cover-overlay .print-cover-content p').forEach((el) => {
    el.style.margin = '0';
    el.style.color = '#ffffff';
    el.style.lineHeight = '1.35';
    el.style.fontSize = '1rem';
    el.style.textShadow = '0 1px 4px rgba(0, 0, 0, 0.75)';
  });
}

function buildJournalPrintStyles(
  oneDayPerPage: boolean,
  fontSize: JournalExportFontSize,
  separateCoverPage: boolean
): string {
  const basePx = FONT_SIZE_PX[fontSize];
  const separateCoverCss = separateCoverPage
    ? `.print-root.separate-cover-page.th-journal-print {
  max-width: none;
  padding: 0;
}
.print-root.separate-cover-page .print-cover-sheet {
  page-break-after: always;
  break-after: page;
  page-break-inside: avoid;
  width: 100%;
}
.print-root.separate-cover-page .print-cover-hero-stage {
  position: relative;
  width: 100%;
  aspect-ratio: ${COVER_PAGE_WIDTH_MM} / ${COVER_PAGE_HEIGHT_MM};
  overflow: hidden;
  background-color: #0f172a;
  background-repeat: no-repeat;
  background-position: center center;
}
.print-root.separate-cover-page .print-cover-hero-stage.hero-fills-page.hasHero {
  background-size: cover;
}
.print-root.separate-cover-page .print-cover-hero-stage.hero-centered.hasHero {
  background-size: contain;
}
.print-root.separate-cover-page .print-cover-hero-full {
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
  display: block;
  object-position: center center;
}
.print-root.separate-cover-page .print-cover-hero-stage.hero-fills-page .print-cover-hero-full {
  object-fit: cover;
}
.print-root.separate-cover-page .print-cover-hero-stage.hero-centered .print-cover-hero-full {
  object-fit: contain;
}
.print-root.separate-cover-page .print-cover-overlay {
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  height: 33%;
  z-index: 2;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 1.25rem 1.5rem;
  text-align: center;
  pointer-events: none;
  background: linear-gradient(180deg, rgba(15, 23, 42, 0.62) 0%, rgba(15, 23, 42, 0.3) 55%, transparent 100%);
}
.print-root.separate-cover-page .print-cover-overlay .print-cover-content {
  display: grid;
  gap: 6px;
  justify-items: center;
  padding: 0;
  color: #fff;
  text-shadow: 0 1px 4px rgba(0, 0, 0, 0.75);
}
.print-root.separate-cover-page .print-cover-overlay .print-cover-content h1 {
  margin: 0;
  color: #fff;
  font-size: 1.85rem;
  line-height: 1.15;
  font-weight: 700;
}
.print-root.separate-cover-page .print-cover-overlay .print-cover-content p {
  margin: 0;
  color: rgba(255, 255, 255, 0.96);
  line-height: 1.35;
  font-size: 1rem;
}
.print-root.separate-cover-page .print-cover-hero-stage.noHero {
  display: flex;
  align-items: center;
  justify-content: center;
  background: linear-gradient(160deg, #1e3a5f 0%, #0f172a 100%);
}
.print-root.separate-cover-page .print-cover-hero-stage.noHero .print-cover-overlay {
  position: static;
  height: auto;
  width: 100%;
  background: none;
}`
    : '';

  let coverBreak = separateCoverCss;
  if (oneDayPerPage) {
    if (separateCoverPage) {
      coverBreak += `.print-root.one-day-per-page .print-day-block.print-day-first { page-break-before: always; }
.print-root.one-day-per-page .print-day-block + .print-day-block { page-break-before: always; }`;
    } else {
      coverBreak += `.print-root.one-day-per-page .print-front-matter { page-break-after: always; }
.print-root.one-day-per-page .print-day-block.print-day-first { page-break-before: always; }
.print-root.one-day-per-page .print-day-block + .print-day-block { page-break-before: always; }`;
    }
  } else if (!separateCoverPage) {
    coverBreak += `.print-root .print-front-matter { page-break-after: auto; }
.print-root .print-day-block { page-break-before: auto; }`;
  }

  return `
html { font-size: ${basePx}px; }
@page { size: portrait; margin: 2.2cm 1.9cm 2.2cm 1.9cm; }
body { margin: 0; font-family: system-ui, -apple-system, Segoe UI, Roboto, sans-serif; color: #0f172a; background: #fff; }
.th-journal-print { padding: 16px 20px 32px; max-width: 46rem; margin: 0 auto; }
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
.photoGrid figcaption { font-size: 0.6875rem; color: #475569; margin: 0; text-align: left; }
.print-album-photos { margin-top: 1rem; }
.print-album-heading { font-size: 1rem; color: #475569; margin: 0 0 0.5rem; text-align: left; }
${coverBreak}
@media print {
  .th-journal-print { padding: 0; max-width: none; }
  .th-journal-print h1, .th-journal-print h2, .th-journal-print h3 { page-break-after: avoid; }
  .print-root.separate-cover-page .print-cover-sheet {
    page-break-after: always;
    break-after: page;
  }
  .print-root.separate-cover-page .print-cover-hero-stage.hasHero {
    position: relative !important;
    display: block !important;
    width: 100% !important;
    height: ${COVER_PAGE_HEIGHT_MM}mm !important;
    min-height: ${COVER_PAGE_HEIGHT_MM}mm !important;
    max-height: ${COVER_PAGE_HEIGHT_MM}mm !important;
    overflow: hidden !important;
    aspect-ratio: auto !important;
    -webkit-print-color-adjust: exact !important;
    print-color-adjust: exact !important;
  }
  .print-root.separate-cover-page .print-cover-hero-stage.hasHero .print-cover-hero-full {
    display: none !important;
  }
  .print-root.separate-cover-page .print-cover-hero-stage.hero-fills-page.hasHero {
    background-size: cover !important;
    background-position: center center !important;
  }
  .print-root.separate-cover-page .print-cover-hero-stage.hero-centered.hasHero {
    background-size: contain !important;
    background-position: center center !important;
  }
  .print-root.separate-cover-page .print-cover-overlay {
    position: absolute !important;
    top: 0 !important;
    left: 0 !important;
    right: 0 !important;
    height: ${COVER_OVERLAY_HEIGHT_MM}mm !important;
    z-index: 2 !important;
    display: flex !important;
    align-items: center !important;
    justify-content: center !important;
    -webkit-print-color-adjust: exact !important;
    print-color-adjust: exact !important;
  }
  .print-root.separate-cover-page .print-cover-overlay .print-cover-content,
  .print-root.separate-cover-page .print-cover-overlay .print-cover-content h1,
  .print-root.separate-cover-page .print-cover-overlay .print-cover-content p {
    color: #fff !important;
  }
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
  separateCoverPage?: boolean;
  fontSize?: JournalExportFontSize;
}

function renderPhotoGrid(items: JournalPhoto[], includePhotoCaptions: boolean): string {
  if (!items.length) return '';
  const sorted = [...items].sort(compareJournalPhotos);
  let html = `<div class="photoGrid">`;
  for (const p of sorted) {
    html += `<figure><img src="${esc(p.fileUrl)}" alt="${esc(p.caption?.trim() ? p.caption : 'Journal photo')}" crossorigin="anonymous" />`;
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
    separateCoverPage = false,
    fontSize = 'medium'
  } = params;

  const showEntryTimestamps = includeEntryTimestamps && trip.showJournalEntryDate !== false;
  const showAuthorNames = includeAuthorNames && trip.showAuthorName !== false;

  const printableDays = [...tripDays]
    .sort((a, b) => a.dayNumber - b.dayNumber)
    .filter((d) => (includePreTrip ? true : d.dayType !== 'PreTrip'));

  const rawHero = includeHeroOnCover && trip.heroImageUrl?.trim() ? trip.heroImageUrl.trim() : '';
  const coverHeroAttr = rawHero.replace(/"/g, '&quot;');
  let body = '';
  if (showCover) {
    if (separateCoverPage) {
      const heroDataAttr = rawHero ? ` data-hero-src="${coverHeroAttr}"` : '';
      body += `<div class="print-cover-sheet"><div class="print-cover-hero-stage ${rawHero ? 'hasHero hero-fills-page' : 'noHero'}"${heroDataAttr}>`;
      if (rawHero) {
        body += `<img class="print-cover-hero-full" src="${coverHeroAttr}" alt="" crossorigin="anonymous" />`;
      }
      body += `<div class="print-cover-overlay"><div class="print-cover-content"><h1>${esc(trip.title)}</h1><p>${esc(trip.destination)}</p><p>${esc(formatOrdinalDateRange(trip.dateStart, trip.dateEnd))}</p></div></div></div></div>`;
      if (showSummary) {
        body += `<div class="print-front-matter"><div class="print-cover-summary">`;
        body += `<div><strong>Total days</strong><span>${printableDays.length}</span></div>`;
        body += `<div><strong>Journal entries</strong><span>${entries.length}</span></div>`;
        body += `<div><strong>Photos</strong><span>${photos.length}</span></div>`;
        body += `<div><strong>Budget</strong><span>Not included in journal export</span></div>`;
        body += `</div></div>`;
      }
    } else {
      body += `<div class="print-front-matter"><div class="print-cover-page ${rawHero ? 'hasHero' : 'noHero'}">`;
      if (rawHero) {
        body += `<img class="print-cover-hero" src="${coverHeroAttr}" alt="" crossorigin="anonymous" />`;
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
  }

  printableDays.forEach((day, idx) => {
    const dayEntries = entries
      .filter((e) => e.dayId === day.id)
      .sort((a, b) => a.entryTimestamp.localeCompare(b.entryTimestamp));
    const dayTitle = esc(formatJournalDayTitle(day));
    const firstClass = oneDayPerPage && idx === 0 ? ' print-day-first' : '';
    body += `<div class="print-day-block${firstClass}">`;
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
          body += `<blockquote style="margin:0.375rem 0;font-size:0.75rem">${esc(c.authorName)}: ${esc(c.commentText)}</blockquote>`;
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

  const useSeparateCover = separateCoverPage && showCover;
  const rootClass = `print-root th-journal-print${showCover ? ' has-cover' : ''}${useSeparateCover ? ' separate-cover-page' : ''}${oneDayPerPage ? ' one-day-per-page' : ''}`;
  const styles = buildJournalPrintStyles(oneDayPerPage, fontSize, useSeparateCover);
  return `<!DOCTYPE html><html class="font-size-${fontSize}"><head><meta charset="utf-8"/><title></title><style>${styles}</style></head><body><div class="${rootClass}">${body}</div></body></html>`;
}
