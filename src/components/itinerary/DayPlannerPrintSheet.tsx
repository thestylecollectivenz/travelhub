import * as React from 'react';
import { buildDayPlannerPrintDocument } from '../../utils/dayPlannerPrintHtml';
import styles from './DayPlannerPrintSheet.module.css';

export interface DayPlannerPrintSheetProps {
  title: string;
  html: string;
  onClose: () => void;
}

/** In-app print preview (iframe) — avoids popup blockers in SharePoint. */
export const DayPlannerPrintSheet: React.FC<DayPlannerPrintSheetProps> = ({ title, html, onClose }) => {
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
        </div>
        <iframe ref={frameRef} className={styles.frame} title={title} srcDoc={html} />
      </div>
    </div>
  );
};

export function buildPlannerPrintHtml(title: string, days: Parameters<typeof buildDayPlannerPrintDocument>[1]): string {
  return buildDayPlannerPrintDocument(title, days);
}
