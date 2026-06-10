import * as React from 'react';
import { paginateJournalPrintDocument } from '../../utils/journalPrintPagination';
import { printHtmlDocument, waitForImages } from '../../utils/printHtmlDocument';
import styles from '../itinerary/DayPlannerPrintSheet.module.css';

export interface JournalPrintSheetProps {
  title: string;
  html: string;
  includePageNumbers?: boolean;
  onClose: () => void;
}

/** In-app journal print preview (iframe) — avoids popup blockers in SharePoint. */
export const JournalPrintSheet: React.FC<JournalPrintSheetProps> = ({
  title,
  html,
  includePageNumbers = false,
  onClose
}) => {
  const frameRef = React.useRef<HTMLIFrameElement | null>(null);

  const clearFrameTitle = React.useCallback((): void => {
    const doc = frameRef.current?.contentDocument;
    if (doc) {
      doc.title = '';
    }
  }, []);

  const runPagination = React.useCallback((): void => {
    const doc = frameRef.current?.contentDocument;
    if (!doc || !includePageNumbers) return;
    void waitForImages(doc).then(() => paginateJournalPrintDocument(doc));
  }, [includePageNumbers]);

  const printFromIframe = React.useCallback((): void => {
    const win = frameRef.current?.contentWindow;
    const doc = frameRef.current?.contentDocument;
    if (!win || !doc) return;

    const doPrint = (): void => {
      const parentTitle = document.title;
      clearFrameTitle();
      document.title = '';

      const restoreTitle = (): void => {
        document.title = parentTitle;
        win.removeEventListener('afterprint', restoreTitle);
      };

      win.addEventListener('afterprint', restoreTitle);

      try {
        win.focus();
        win.print();
      } catch {
        restoreTitle();
      }
    };

    if (includePageNumbers && !doc.querySelector('.print-pages')) {
      void waitForImages(doc).then(() => {
        paginateJournalPrintDocument(doc);
        doPrint();
      });
      return;
    }

    doPrint();
  }, [clearFrameTitle, includePageNumbers]);

  const handlePrint = React.useCallback((): void => {
    printHtmlDocument(
      html,
      printFromIframe,
      includePageNumbers ? paginateJournalPrintDocument : undefined
    );
  }, [html, includePageNumbers, printFromIframe]);

  const handleFrameLoad = React.useCallback((): void => {
    clearFrameTitle();
    runPagination();
  }, [clearFrameTitle, runPagination]);

  return (
    <div className={styles.backdrop} role="presentation">
      <div className={styles.sheet} role="dialog" aria-modal="true" aria-label={title}>
        <div className={styles.toolbar}>
          <button type="button" className={styles.printBtn} onClick={handlePrint}>
            Print / Save PDF
          </button>
          <button type="button" className={styles.closeBtn} onClick={onClose}>
            Close
          </button>
          {includePageNumbers ? (
            <p className={styles.printHint}>
              Turn <strong>Headers and footers</strong> <strong>Off</strong> in the print dialog — page numbers are in the journal footer.
            </p>
          ) : null}
        </div>
        <iframe
          ref={frameRef}
          className={styles.frame}
          title={title}
          srcDoc={html}
          onLoad={handleFrameLoad}
        />
      </div>
    </div>
  );
};
