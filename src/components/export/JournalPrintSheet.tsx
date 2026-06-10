import * as React from 'react';
import { printHtmlDocument } from '../../utils/printHtmlDocument';
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

  const printFromIframe = React.useCallback((): void => {
    const win = frameRef.current?.contentWindow;
    if (!win) return;

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
  }, [clearFrameTitle]);

  const handlePrint = React.useCallback((): void => {
    printHtmlDocument(html, printFromIframe);
  }, [html, printFromIframe]);

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
          onLoad={clearFrameTitle}
        />
      </div>
    </div>
  );
};
