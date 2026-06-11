import * as React from 'react';
import { prepareJournalCoverForPrint } from '../../utils/journalPrintPreview';
import styles from '../itinerary/DayPlannerPrintSheet.module.css';

export interface JournalPrintSheetProps {
  title: string;
  html: string;
  onClose: () => void;
}

/** In-app journal print preview (iframe) — avoids popup blockers in SharePoint. */
export const JournalPrintSheet: React.FC<JournalPrintSheetProps> = ({ title, html, onClose }) => {
  const frameRef = React.useRef<HTMLIFrameElement | null>(null);

  const clearFrameTitle = React.useCallback((): void => {
    const doc = frameRef.current?.contentDocument;
    if (doc) {
      doc.title = '';
    }
  }, []);

  const waitForPrintReady = React.useCallback(async (doc: Document): Promise<void> => {
    const images = Array.from(doc.querySelectorAll('img'));
    await Promise.all(
      images.map(
        (img) =>
          new Promise<void>((resolve) => {
            if (img.complete) {
              resolve();
              return;
            }
            const finish = (): void => resolve();
            img.addEventListener('load', finish, { once: true });
            img.addEventListener('error', finish, { once: true });
          })
      )
    );
  }, []);

  const handlePrint = React.useCallback(async (): Promise<void> => {
    const win = frameRef.current?.contentWindow;
    const doc = frameRef.current?.contentDocument;
    if (!win || !doc) return;

    await waitForPrintReady(doc);
    prepareJournalCoverForPrint(doc);

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
  }, [clearFrameTitle, waitForPrintReady]);

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
