import * as React from 'react';
import { embedCoverHeroForPrint, prepareJournalCoverForPrint } from '../../utils/journalPrintPreview';
import styles from '../itinerary/DayPlannerPrintSheet.module.css';

const PRINT_IMAGE_TIMEOUT_MS = 12000;

export interface JournalPrintSheetProps {
  title: string;
  html: string;
  onClose: () => void;
  /** Fired after the browser print / save PDF dialog closes. */
  onAfterPrint?: () => void;
}

/** In-app journal print preview (iframe) — avoids popup blockers in SharePoint. */
export const JournalPrintSheet: React.FC<JournalPrintSheetProps> = ({ title, html, onClose, onAfterPrint }) => {
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
            if (img.complete && img.naturalWidth > 0) {
              resolve();
              return;
            }
            let settled = false;
            let timer = 0;
            const finish = (): void => {
              if (settled) return;
              settled = true;
              window.clearTimeout(timer);
              resolve();
            };
            timer = window.setTimeout(finish, PRINT_IMAGE_TIMEOUT_MS);
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
    await embedCoverHeroForPrint(doc);
    await waitForPrintReady(doc);
    prepareJournalCoverForPrint(doc);

    const parentTitle = document.title;
    clearFrameTitle();
    document.title = '';

    const onAfterPrintEvent = (): void => {
      document.title = parentTitle;
      win.removeEventListener('afterprint', onAfterPrintEvent);
      onAfterPrint?.();
    };

    win.addEventListener('afterprint', onAfterPrintEvent);

    try {
      win.focus();
      win.print();
    } catch {
      document.title = parentTitle;
      win.removeEventListener('afterprint', onAfterPrintEvent);
    }
  }, [clearFrameTitle, waitForPrintReady, onAfterPrint]);

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
