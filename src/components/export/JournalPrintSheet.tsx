import * as React from 'react';
import { downloadJournalPdf } from '../../utils/journalPdfDownload';
import styles from '../itinerary/DayPlannerPrintSheet.module.css';

export interface JournalPrintSheetProps {
  title: string;
  html: string;
  fileName: string;
  onClose: () => void;
}

/** In-app journal print preview (iframe) — avoids popup blockers in SharePoint. */
export const JournalPrintSheet: React.FC<JournalPrintSheetProps> = ({ title, html, fileName, onClose }) => {
  const frameRef = React.useRef<HTMLIFrameElement | null>(null);
  const [pdfBusy, setPdfBusy] = React.useState(false);
  const [pdfError, setPdfError] = React.useState<string | null>(null);

  const handlePrint = React.useCallback((): void => {
    const win = frameRef.current?.contentWindow;
    if (!win) return;
    try {
      win.focus();
      win.print();
    } catch {
      /* ignore */
    }
  }, []);

  const handleDownloadPdf = React.useCallback(async (): Promise<void> => {
    const frame = frameRef.current;
    if (!frame || pdfBusy) return;
    setPdfError(null);
    setPdfBusy(true);
    try {
      await downloadJournalPdf(frame, fileName, window.location.href);
    } catch (err) {
      setPdfError(err instanceof Error ? err.message : 'Could not create PDF.');
    } finally {
      setPdfBusy(false);
    }
  }, [fileName, pdfBusy]);

  return (
    <div className={styles.backdrop} role="presentation">
      <div className={styles.sheet} role="dialog" aria-modal="true" aria-label={title}>
        <div className={styles.toolbar}>
          <button type="button" className={styles.printBtn} onClick={handleDownloadPdf} disabled={pdfBusy}>
            {pdfBusy ? 'Creating PDF…' : 'Download PDF'}
          </button>
          <button type="button" className={styles.closeBtn} onClick={handlePrint} disabled={pdfBusy}>
            Print
          </button>
          <button type="button" className={styles.closeBtn} onClick={onClose} disabled={pdfBusy}>
            Close
          </button>
          <p className={styles.printHint}>
            <strong>Download PDF</strong> adds URL and page numbers in the footer (no date/time).
            <strong> Print</strong> uses your browser&apos;s native headers and footers — keep them on for URL and page numbers
            (the browser may also add date/time).
          </p>
          {pdfError ? <p className={styles.printHint}>{pdfError}</p> : null}
        </div>
        <iframe ref={frameRef} className={styles.frame} title={title} srcDoc={html} />
      </div>
    </div>
  );
};
