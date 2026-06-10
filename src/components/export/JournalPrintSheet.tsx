import * as React from 'react';
import styles from '../itinerary/DayPlannerPrintSheet.module.css';

export interface JournalPrintSheetProps {
  title: string;
  html: string;
  onClose: () => void;
}

/** In-app journal print preview (iframe) — avoids popup blockers in SharePoint. */
export const JournalPrintSheet: React.FC<JournalPrintSheetProps> = ({ title, html, onClose }) => {
  const frameRef = React.useRef<HTMLIFrameElement | null>(null);

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
          <p className={styles.printHint}>
            For a clean PDF: in the print dialog set <strong>Headers and footers</strong> to <strong>Off</strong> (removes the
            browser date, URL, and duplicate title). Layout is portrait with trip name left and day title right on each day.
          </p>
        </div>
        <iframe ref={frameRef} className={styles.frame} title={title} srcDoc={html} />
      </div>
    </div>
  );
};
