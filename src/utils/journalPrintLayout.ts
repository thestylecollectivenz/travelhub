/** Shared A4 print layout constants for journal export pagination. */

export const JOURNAL_PAGE_HEIGHT_MM = 297;
export const JOURNAL_MARGIN_TOP_MM = 12;
export const JOURNAL_MARGIN_SIDE_MM = 12;
export const JOURNAL_MARGIN_BOTTOM_MM = 12;
export const JOURNAL_FOOTER_BAND_MM = 8;

export const JOURNAL_SHEET_HEIGHT_MM =
  JOURNAL_PAGE_HEIGHT_MM - JOURNAL_MARGIN_TOP_MM - JOURNAL_MARGIN_BOTTOM_MM;

export const JOURNAL_CONTENT_HEIGHT_MM = JOURNAL_SHEET_HEIGHT_MM - JOURNAL_FOOTER_BAND_MM;

const MM_TO_PX = 96 / 25.4;

export const JOURNAL_PAGE_CONTENT_WIDTH_PX = (210 - JOURNAL_MARGIN_SIDE_MM * 2) * MM_TO_PX;

export const JOURNAL_PAGE_CONTENT_HEIGHT_PX = JOURNAL_CONTENT_HEIGHT_MM * MM_TO_PX;

export function journalPrintPageMargins(includePageNumbers: boolean): string {
  if (!includePageNumbers) {
    return '1.5cm 1.5cm 1.5cm 1.5cm';
  }
  return `${JOURNAL_MARGIN_TOP_MM}mm ${JOURNAL_MARGIN_SIDE_MM}mm ${JOURNAL_MARGIN_BOTTOM_MM}mm ${JOURNAL_MARGIN_SIDE_MM}mm`;
}
