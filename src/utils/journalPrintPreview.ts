import type { Trip } from '../models/Trip';
import type { TripDay } from '../models/TripDay';
import type { JournalEntry, JournalPhoto, JournalComment } from '../models';
import { compareJournalPhotos } from './compareJournalPhotos';
import { photoObjectPosition } from './journalPhotoFocal';
import { journalPhotoPrintUrl } from './journalPhotoDisplayUrl';
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
export type CoverTitleFontSize = JournalExportFontSize;
export type CoverTitleAlign = 'center' | 'left';

const FONT_SIZE_PX: Record<JournalExportFontSize, number> = {
  small: 14,
  medium: 16,
  large: 18
};

const COVER_TITLE_H1_REM: Record<CoverTitleFontSize, { inline: string; overlay: string }> = {
  small: { inline: '1.35rem', overlay: '1.45rem' },
  medium: { inline: '1.75rem', overlay: '1.85rem' },
  large: { inline: '2.35rem', overlay: '2.5rem' }
};

/** Location + dates scale with title (medium overlay title 1.85rem → subtitle 1rem). */
const COVER_SUBTITLE_TO_TITLE_RATIO = 1 / 1.85;

function coverSubtitleRem(titleRem: string): string {
  const titlePx = parseFloat(titleRem);
  const subtitlePx = Math.round(titlePx * COVER_SUBTITLE_TO_TITLE_RATIO * 1000) / 1000;
  return `${subtitlePx}rem`;
}

function coverSubtitleSizes(size: CoverTitleFontSize): { inline: string; overlay: string } {
  const h1 = COVER_TITLE_H1_REM[size];
  return {
    inline: coverSubtitleRem(h1.inline),
    overlay: coverSubtitleRem(h1.overlay)
  };
}

function coverTitleSizeClass(size: CoverTitleFontSize): string {
  return `cover-title-size-${size}`;
}

function readCoverTitleFontSize(doc: Document): CoverTitleFontSize {
  const root = doc.querySelector('.print-root');
  if (root?.classList.contains('cover-title-size-small')) return 'small';
  if (root?.classList.contains('cover-title-size-large')) return 'large';
  return 'medium';
}

function buildCoverTitleSizeCss(size: CoverTitleFontSize): string {
  const h1 = COVER_TITLE_H1_REM[size];
  const p = coverSubtitleSizes(size);
  return `.print-root.${coverTitleSizeClass(size)} .print-cover-content h1 {
  font-size: ${h1.inline};
  line-height: 1.15;
}
.print-root.${coverTitleSizeClass(size)} .print-cover-content p {
  font-size: ${p.inline};
  line-height: 1.35;
}
.print-root.${coverTitleSizeClass(size)}.separate-cover-page .print-cover-overlay .print-cover-content h1 {
  font-size: ${h1.overlay};
  line-height: 1.15;
}
.print-root.${coverTitleSizeClass(size)}.separate-cover-page .print-cover-overlay .print-cover-content p {
  font-size: ${p.overlay};
  line-height: 1.35;
}`;
}

/** A4 page with 22mm top/bottom and 19mm left/right @page margins (mm). */
const A4_WIDTH_MM = 210;
const A4_HEIGHT_MM = 297;
const PAGE_MARGIN_X_MM = 19;
const PAGE_MARGIN_Y_MM = 22;
const COVER_PAGE_WIDTH_MM = A4_WIDTH_MM - PAGE_MARGIN_X_MM * 2;
const COVER_PAGE_HEIGHT_MM = A4_HEIGHT_MM - PAGE_MARGIN_Y_MM * 2;
/** Below this effective DPI, hero is centred with contain instead of full-page cover. */
const COVER_HERO_MIN_DPI = 150;
const COVER_OVERLAY_HEIGHT_MM = Math.round(A4_HEIGHT_MM * 0.33);

export function heroFillsPrintPage(naturalWidth: number, naturalHeight: number): boolean {
  if (!naturalWidth || !naturalHeight) return true;
  const needW = Math.round((A4_WIDTH_MM / 25.4) * COVER_HERO_MIN_DPI);
  const needH = Math.round((A4_HEIGHT_MM / 25.4) * COVER_HERO_MIN_DPI);
  return Math.max(needW / naturalWidth, needH / naturalHeight) <= 1;
}

/** Embed hero as data URL so it prints in PDF (background-image from SharePoint URLs does not). */
export async function embedCoverHeroForPrint(doc: Document): Promise<void> {
  const img = doc.querySelector<HTMLImageElement>('.print-cover-hero-stage.hasHero .print-cover-hero-full');
  if (!img?.src || img.dataset.embedded === '1') return;

  const win = doc.defaultView;
  const src = img.currentSrc || img.src;

  const loadDataUrl = (dataUrl: string): Promise<void> =>
    new Promise((resolve, reject) => {
      const onLoad = (): void => {
        img.dataset.embedded = '1';
        resolve();
      };
      const onError = (): void => {
        reject(new Error('hero embed load failed'));
      };
      img.addEventListener('load', onLoad, { once: true });
      img.addEventListener('error', onError, { once: true });
      img.src = dataUrl;
    });

  if (src.startsWith('data:')) {
    img.dataset.embedded = '1';
    return;
  }

  if (win) {
    try {
      const response = await win.fetch(src, { credentials: 'include' });
      if (response.ok) {
        const blob = await response.blob();
        const dataUrl = await new Promise<string>((resolve, reject) => {
          const reader = new FileReader();
          reader.onload = () => resolve(String(reader.result));
          reader.onerror = () => reject(reader.error);
          reader.readAsDataURL(blob);
        });
        await loadDataUrl(dataUrl);
        return;
      }
    } catch {
      /* try canvas fallback */
    }
  }

  if (img.complete && img.naturalWidth > 0) {
    try {
      const canvas = doc.createElement('canvas');
      canvas.width = img.naturalWidth;
      canvas.height = img.naturalHeight;
      const ctx = canvas.getContext('2d');
      if (ctx) {
        ctx.drawImage(img, 0, 0);
        await loadDataUrl(canvas.toDataURL('image/jpeg', 0.92));
      }
    } catch {
      /* keep original src */
    }
  }
}

/** Lock cover layout for browser print/PDF. */
export function prepareJournalCoverForPrint(doc: Document): void {
  const stage = doc.querySelector<HTMLElement>('.print-cover-hero-stage.hasHero');
  if (!stage) return;

  const sheet = stage.closest<HTMLElement>('.print-cover-sheet');
  const img = stage.querySelector<HTMLImageElement>('.print-cover-hero-full');
  const fillsPage = img ? heroFillsPrintPage(img.naturalWidth, img.naturalHeight) : true;

  stage.classList.remove('hero-fills-page', 'hero-centered');
  stage.classList.add(fillsPage ? 'hero-fills-page' : 'hero-centered');

  const coverWidth = `${A4_WIDTH_MM}mm`;
  const coverHeight = `${A4_HEIGHT_MM}mm`;
  stage.style.position = 'relative';
  stage.style.display = 'block';
  stage.style.width = coverWidth;
  stage.style.height = coverHeight;
  stage.style.maxHeight = coverHeight;
  stage.style.overflow = 'hidden';
  stage.style.margin = '0';
  stage.style.padding = '0';
  stage.style.boxSizing = 'border-box';
  stage.style.backgroundColor = '#0f172a';
  stage.style.backgroundImage = 'none';
  if (sheet) {
    sheet.style.margin = '0';
    sheet.style.padding = '0';
    sheet.style.width = coverWidth;
    sheet.style.height = coverHeight;
    sheet.style.maxHeight = coverHeight;
    sheet.style.overflow = 'hidden';
    sheet.style.pageBreakAfter = 'always';
    sheet.style.breakAfter = 'page';
  }
  stage.style.setProperty('-webkit-print-color-adjust', 'exact');
  stage.style.setProperty('print-color-adjust', 'exact');

  if (img) {
    img.style.display = 'block';
    img.style.position = 'absolute';
    img.style.inset = '0';
    img.style.width = '100%';
    img.style.height = '100%';
    img.style.maxWidth = '100%';
    img.style.maxHeight = '100%';
    img.style.objectFit = fillsPage ? 'cover' : 'contain';
    img.style.objectPosition = 'center center';
    img.style.zIndex = '1';
  }

  const isLeftAlign = doc.querySelector('.print-root')?.classList.contains('cover-title-left') === true;
  const overlay = stage.querySelector<HTMLElement>('.print-cover-overlay');
  if (overlay) {
    overlay.style.position = 'absolute';
    overlay.style.top = '0';
    overlay.style.left = '0';
    overlay.style.right = '0';
    overlay.style.height = `${COVER_OVERLAY_HEIGHT_MM}mm`;
    overlay.style.zIndex = '2';
    overlay.style.display = 'flex';
    overlay.style.alignItems = isLeftAlign ? 'flex-start' : 'center';
    overlay.style.justifyContent = isLeftAlign ? 'flex-start' : 'center';
    overlay.style.padding = '1.25rem 1.5rem';
    overlay.style.textAlign = isLeftAlign ? 'left' : 'center';
    overlay.style.boxSizing = 'border-box';
    overlay.style.background =
      'linear-gradient(180deg, rgba(15, 23, 42, 0.62) 0%, rgba(15, 23, 42, 0.3) 55%, transparent 100%)';
    overlay.style.setProperty('-webkit-print-color-adjust', 'exact');
    overlay.style.setProperty('print-color-adjust', 'exact');
    const content = overlay.querySelector<HTMLElement>('.print-cover-content');
    if (content) {
      content.style.justifyItems = isLeftAlign ? 'start' : 'center';
      content.style.textAlign = isLeftAlign ? 'left' : 'center';
    }
  }

  const coverTitleSize = readCoverTitleFontSize(doc);
  const coverH1 = COVER_TITLE_H1_REM[coverTitleSize].overlay;
  const coverP = coverSubtitleSizes(coverTitleSize).overlay;

  stage.querySelectorAll<HTMLElement>('.print-cover-overlay .print-cover-content h1').forEach((el) => {
    el.style.margin = '0';
    el.style.color = '#ffffff';
    el.style.fontSize = coverH1;
    el.style.lineHeight = '1.15';
    el.style.fontWeight = '700';
    el.style.textShadow = '0 1px 4px rgba(0, 0, 0, 0.75)';
  });

  stage.querySelectorAll<HTMLElement>('.print-cover-overlay .print-cover-content p').forEach((el) => {
    el.style.margin = '0';
    el.style.color = '#ffffff';
    el.style.lineHeight = '1.35';
    el.style.fontSize = coverP;
    el.style.textShadow = '0 1px 4px rgba(0, 0, 0, 0.75)';
  });
}

function buildJournalPrintStyles(
  oneDayPerPage: boolean,
  fontSize: JournalExportFontSize,
  separateCoverPage: boolean,
  coverTitleAlign: CoverTitleAlign,
  coverTitleFontSize: CoverTitleFontSize
): string {
  const basePx = FONT_SIZE_PX[fontSize];
  const coverTitleSizeCss = buildCoverTitleSizeCss(coverTitleFontSize);
  const coverTitleCss =
    coverTitleAlign === 'left'
      ? `.print-root.cover-title-left .print-cover-content {
  justify-items: start;
  text-align: left;
}
.print-root.cover-title-left.separate-cover-page .print-cover-overlay {
  align-items: flex-start;
  justify-content: flex-start;
  text-align: left;
}
.print-root.cover-title-left.separate-cover-page .print-cover-overlay .print-cover-content {
  justify-items: start;
  text-align: left;
}
.print-root.cover-title-left.separate-cover-page .print-cover-hero-stage.noHero {
  align-items: flex-start;
  justify-content: flex-start;
}
.print-root.cover-title-left.separate-cover-page .print-cover-hero-stage.noHero .print-cover-overlay {
  padding: 1.5rem;
}`
      : `.print-root.cover-title-center .print-cover-content {
  justify-items: center;
  text-align: center;
}
.print-root.cover-title-center.separate-cover-page .print-cover-overlay {
  align-items: center;
  justify-content: center;
  text-align: center;
}
.print-root.cover-title-center.separate-cover-page .print-cover-overlay .print-cover-content {
  justify-items: center;
  text-align: center;
}`;
  const separateCoverCss = separateCoverPage
    ? `.print-root.separate-cover-page .print-cover-sheet {
  page: cover;
  page-break-after: always;
  break-after: page;
  page-break-inside: avoid;
  width: ${A4_WIDTH_MM}mm;
  max-width: ${A4_WIDTH_MM}mm;
  margin: 0 auto;
}
.print-root.separate-cover-page .print-cover-sheet + .print-front-matter,
.print-root.separate-cover-page .print-cover-sheet + .print-day-block {
  margin-top: 0;
  padding-top: 0;
}
.print-root.separate-cover-page .print-day-block:first-of-type {
  margin-top: 0;
  padding-top: 0;
}
.print-root.separate-cover-page .print-cover-hero-stage {
  position: relative;
  width: 100%;
  aspect-ratio: ${A4_WIDTH_MM} / ${A4_HEIGHT_MM};
  overflow: hidden;
  background-color: #0f172a;
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
  line-height: 1.15;
  font-weight: 700;
}
.print-root.separate-cover-page .print-cover-overlay .print-cover-content p {
  margin: 0;
  color: rgba(255, 255, 255, 0.96);
  line-height: 1.35;
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
      coverBreak += `.print-root.separate-cover-page.one-day-per-page .print-day-block.print-day-first { page-break-before: auto; }
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
@page { size: A4 portrait; margin: ${PAGE_MARGIN_Y_MM}mm ${PAGE_MARGIN_X_MM}mm; }
@page cover { size: A4 portrait; margin: 0; }
body { margin: 0; font-family: system-ui, -apple-system, Segoe UI, Roboto, sans-serif; color: #0f172a; background: #fff; }
/* Heading orphans only: keep headings with the content that follows; allow body text and photos to flow naturally */
.print-day-head { break-inside: avoid; page-break-inside: avoid; }
.print-day-head .print-day-heading { margin-bottom: 0.35rem; }
.print-day-heading,
.print-album-heading,
.print-entry-heading { break-after: avoid; page-break-after: avoid; }
.print-day-head + .print-entry,
.print-day-head + .print-album-photos { break-before: avoid; page-break-before: avoid; }
.print-album-heading + .photoGrid { break-before: avoid; page-break-before: avoid; }
.th-journal-print { padding: 16px 20px 32px; max-width: 46rem; margin: 0 auto; }
.print-front-matter { page-break-inside: avoid; margin-bottom: 0.5rem; }
.print-cover-page { display: grid; grid-template-rows: auto auto; page-break-after: avoid; min-height: auto; }
.print-cover-hero { width: 100%; max-height: 9rem; object-fit: cover; object-position: center; }
.print-cover-content { display: grid; gap: 4px; padding: 8px 16px 4px; }
${coverTitleCss}
${coverTitleSizeCss}
.print-cover-content h1 { margin: 0; line-height: 1.2; }
.print-cover-content p { margin: 0; line-height: 1.35; }
.print-cover-summary { margin-top: 8px; width: min(36rem, 100%); border: 1px solid #e2e8f0; border-radius: 12px; overflow: hidden; }
.print-cover-summary > div { display: grid; grid-template-columns: 1fr auto; gap: 8px; padding: 8px 12px; border-bottom: 1px solid #e2e8f0; }
.print-cover-summary > div:last-child { border-bottom: none; }
.print-day-block { page-break-inside: auto; }
.print-day-section { margin-top: 0; padding-top: 0; border-top: none; }
.print-root.has-cover:not(.separate-cover-page) .print-day-block:first-of-type { margin-top: 0.75rem; }
.print-root.separate-cover-page.has-cover .print-day-block:first-of-type { margin-top: 0; }
.print-root:not(.has-cover) .print-day-block:first-of-type { margin-top: 0; }
.print-day-block + .print-day-block { margin-top: 1.25rem; padding-top: 0.75rem; border-top: 1px solid #ddd; }
.print-day-heading { margin-bottom: 0.75rem; font-size: 1.35rem; }
.print-entry { margin-bottom: 1.5rem; }
.print-entry-meta { margin-bottom: 0.5rem; color: #64748b; font-size: 0.85rem; text-align: left; }
.print-entry-heading { margin: 0 0 0.35rem; font-size: 1rem; text-align: left; }
.print-entry-body { text-align: left; }
.photoGrid { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 10px; margin-top: 0.75rem; }
.photoGrid figure { margin: 0; display: flex; flex-direction: column; gap: 4px; }
.photoGrid img { width: 100%; aspect-ratio: 1; object-fit: cover; object-position: center center; display: block; border-radius: 4px; }
.photoGrid figcaption { font-size: 0.6875rem; color: #475569; margin: 0; text-align: left; }
.print-album-photos { margin-top: 1rem; }
.print-album-heading { font-size: 1rem; color: #475569; margin: 0 0 0.5rem; text-align: left; }
${coverBreak}
@media print {
  .th-journal-print { padding: 0; max-width: none; }
  .th-journal-print h1, .th-journal-print h2, .th-journal-print h3 { page-break-after: avoid; }
  .print-root.separate-cover-page .print-cover-sheet {
    page: cover !important;
    page-break-after: always;
    break-after: page;
    margin: 0 !important;
    padding: 0 !important;
    width: ${A4_WIDTH_MM}mm !important;
    max-width: ${A4_WIDTH_MM}mm !important;
    height: ${A4_HEIGHT_MM}mm !important;
    max-height: ${A4_HEIGHT_MM}mm !important;
    overflow: hidden !important;
    page-break-inside: avoid !important;
  }
  .print-root.separate-cover-page .print-cover-hero-stage.hasHero {
    position: relative !important;
    display: block !important;
    width: 100% !important;
    height: ${A4_HEIGHT_MM}mm !important;
    max-height: ${A4_HEIGHT_MM}mm !important;
    overflow: hidden !important;
    aspect-ratio: auto !important;
    margin: 0 !important;
    padding: 0 !important;
    box-sizing: border-box !important;
    page-break-after: avoid !important;
    break-after: avoid !important;
    -webkit-print-color-adjust: exact !important;
    print-color-adjust: exact !important;
  }
  .print-root.separate-cover-page .print-cover-sheet + .print-front-matter,
  .print-root.separate-cover-page .print-cover-sheet + .print-day-block,
  .print-root.separate-cover-page .print-day-block:first-of-type {
    margin-top: 0 !important;
    padding-top: 0 !important;
    page-break-before: auto !important;
  }
  .print-day-head { break-inside: avoid !important; page-break-inside: avoid !important; }
  .print-day-heading,
  .print-album-heading,
  .print-entry-heading { break-after: avoid !important; page-break-after: avoid !important; }
  .print-day-head + .print-entry,
  .print-day-head + .print-album-photos { break-before: avoid !important; page-break-before: avoid !important; }
  .print-album-heading + .photoGrid { break-before: avoid !important; page-break-before: avoid !important; }
  .print-root.separate-cover-page .print-cover-hero-stage.hasHero .print-cover-hero-full {
    display: block !important;
    position: absolute !important;
    inset: 0 !important;
    width: 100% !important;
    height: 100% !important;
    z-index: 1 !important;
    -webkit-print-color-adjust: exact !important;
    print-color-adjust: exact !important;
  }
  .print-root.separate-cover-page .print-cover-hero-stage.hero-fills-page .print-cover-hero-full {
    object-fit: cover !important;
    object-position: center center !important;
  }
  .print-root.separate-cover-page .print-cover-hero-stage.hero-centered .print-cover-hero-full {
    object-fit: contain !important;
    object-position: center center !important;
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
  .print-root.cover-title-left.separate-cover-page .print-cover-overlay {
    align-items: flex-start !important;
    justify-content: flex-start !important;
    text-align: left !important;
  }
  .print-root.cover-title-left.separate-cover-page .print-cover-overlay .print-cover-content {
    justify-items: start !important;
    text-align: left !important;
  }
  .print-root.cover-title-left .print-cover-content {
    justify-items: start !important;
    text-align: left !important;
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
  coverTitleAlign?: CoverTitleAlign;
  coverTitleFontSize?: CoverTitleFontSize;
  fontSize?: JournalExportFontSize;
  /** Same ordering as journal entry cards (incl. drag-reorder). */
  photosForEntry?: (entryId: string) => JournalPhoto[];
}

function renderPhotoGrid(
  items: JournalPhoto[],
  includePhotoCaptions: boolean,
  preserveOrder = false
): string {
  if (!items.length) return '';
  const sorted = preserveOrder ? items : [...items].sort(compareJournalPhotos);
  let html = `<div class="photoGrid">`;
  for (const p of sorted) {
    const pos = photoObjectPosition(p);
    const src = journalPhotoPrintUrl(p.fileUrl);
    html += `<figure><img src="${esc(src)}" alt="${esc(p.caption?.trim() ? p.caption : 'Journal photo')}" style="object-position:${pos}" loading="lazy" decoding="async" />`;
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
    coverTitleAlign = 'center',
    coverTitleFontSize = 'medium',
    fontSize = 'medium',
    photosForEntry
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
        body += `<img class="print-cover-hero-full" src="${coverHeroAttr}" alt="" />`;
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
    body += `<section class="print-day-section"><div class="print-day-head"><h2 class="print-day-heading">${dayTitle}</h2>`;
    if (day.dayType !== 'PreTrip') {
      body += `<p class="print-entry-meta print-day-date">${esc(formatOrdinalDayDate(day.calendarDate))}</p>`;
    }
    body += `</div>`;
    for (const entry of dayEntries) {
      const entryPhotos = photosForEntry
        ? photosForEntry(entry.id)
        : photos.filter((p) => p.journalEntryId === entry.id).sort(compareJournalPhotos);
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
      body += renderPhotoGrid(entryPhotos, includePhotoCaptions, Boolean(photosForEntry));
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
  const titleAlignClass = showCover ? (coverTitleAlign === 'left' ? ' cover-title-left' : ' cover-title-center') : '';
  const titleSizeClass = showCover ? ` ${coverTitleSizeClass(coverTitleFontSize)}` : '';
  const rootClass = `print-root th-journal-print${showCover ? ' has-cover' : ''}${useSeparateCover ? ' separate-cover-page' : ''}${oneDayPerPage ? ' one-day-per-page' : ''}${titleAlignClass}${titleSizeClass}`;
  const styles = buildJournalPrintStyles(oneDayPerPage, fontSize, useSeparateCover, coverTitleAlign, coverTitleFontSize);
  return `<!DOCTYPE html><html class="font-size-${fontSize}"><head><meta charset="utf-8"/><title></title><style>${styles}</style></head><body><div class="${rootClass}">${body}</div></body></html>`;
}
