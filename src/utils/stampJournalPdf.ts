import type { CoverTitleAlign } from './journalPrintPreview';

export interface JournalPdfStampOptions {
  /** Footer left — page URL */
  includeFooterUrl: boolean;
  sourceUrl: string;
  /** Footer right — e.g. 2 / 7 */
  includePageNumbers: boolean;
  /** Header left — trip title */
  includeHeaderTripTitle: boolean;
  tripTitle: string;
  /** Header trip title — centred or left within the page */
  headerTripTitleAlign?: CoverTitleAlign;
  /** Header right — export date */
  includeHeaderDate: boolean;
  /** Omit stamping on PDF page 1 (separate cover page) */
  skipCoverPageStamp?: boolean;
}

const STAMP_FONT_SIZE = 8;
const MARGIN_X_PT = 34;
const HEADER_Y_OFFSET_PT = 22;
const FOOTER_Y_PT = 18;
const STAMP_COLOR = { r: 0.39, g: 0.45, b: 0.55 };

function truncateText(text: string, maxLen: number): string {
  const trimmed = text.trim();
  if (trimmed.length <= maxLen) return trimmed;
  return `${trimmed.slice(0, maxLen - 1)}…`;
}

function formatExportDate(): string {
  return new Date().toLocaleDateString('en-NZ', {
    day: 'numeric',
    month: 'long',
    year: 'numeric'
  });
}

export async function stampJournalPdf(file: File, options: JournalPdfStampOptions): Promise<Uint8Array> {
  const bytes = new Uint8Array(await file.arrayBuffer());
  const { PDFDocument, rgb, StandardFonts } = await import(/* webpackChunkName: 'pdf-lib' */ 'pdf-lib');

  const pdf = await PDFDocument.load(bytes);
  const font = await pdf.embedFont(StandardFonts.Helvetica);
  const pages = pdf.getPages();
  const total = pages.length;
  const color = rgb(STAMP_COLOR.r, STAMP_COLOR.g, STAMP_COLOR.b);
  const headerDate = formatExportDate();

  const hasHeader = options.includeHeaderTripTitle || options.includeHeaderDate;
  const hasFooter = options.includeFooterUrl || options.includePageNumbers;

  if (!hasHeader && !hasFooter) {
    return pdf.save();
  }

  const skipCover = options.skipCoverPageStamp === true && total > 1;

  pages.forEach((page, index) => {
    if (skipCover && index === 0) {
      return;
    }

    const { width, height } = page.getSize();
    const pageNum = index + 1;

    if (options.includeHeaderTripTitle && options.tripTitle.trim()) {
      const text = truncateText(options.tripTitle.trim(), 72);
      const textWidth = font.widthOfTextAtSize(text, STAMP_FONT_SIZE);
      const titleAlign = options.headerTripTitleAlign === 'left' ? 'left' : 'center';
      const titleX = titleAlign === 'center' ? (width - textWidth) / 2 : MARGIN_X_PT;
      page.drawText(text, {
        x: titleX,
        y: height - HEADER_Y_OFFSET_PT,
        size: STAMP_FONT_SIZE,
        font,
        color
      });
    }

    if (options.includeHeaderDate) {
      const textWidth = font.widthOfTextAtSize(headerDate, STAMP_FONT_SIZE);
      page.drawText(headerDate, {
        x: width - MARGIN_X_PT - textWidth,
        y: height - HEADER_Y_OFFSET_PT,
        size: STAMP_FONT_SIZE,
        font,
        color
      });
    }

    if (options.includeFooterUrl && options.sourceUrl.trim()) {
      const maxUrlChars = Math.max(24, Math.floor((width - MARGIN_X_PT * 2 - 56) / 4.5));
      const url = truncateText(options.sourceUrl.trim(), maxUrlChars);
      page.drawText(url, {
        x: MARGIN_X_PT,
        y: FOOTER_Y_PT,
        size: STAMP_FONT_SIZE,
        font,
        color
      });
    }

    if (options.includePageNumbers) {
      const label = `${pageNum} / ${total}`;
      const textWidth = font.widthOfTextAtSize(label, STAMP_FONT_SIZE);
      page.drawText(label, {
        x: width - MARGIN_X_PT - textWidth,
        y: FOOTER_Y_PT,
        size: STAMP_FONT_SIZE,
        font,
        color
      });
    }
  });

  return pdf.save();
}

export { saveStampedJournalPdf as downloadStampedPdf } from './journalExportFilePicker';

export function stampedJournalFileName(tripTitle: string): string {
  const base = (tripTitle || 'journal').replace(/[<>:"/\\|?*]+/g, '-').trim();
  return `${base} — Journal (stamped).pdf`;
}
