import * as React from 'react';
import { buildBudgetPrintHtml } from '../../utils/exportBudgetExcel';
import styles from '../itinerary/DayPlannerPrintSheet.module.css';

export interface BudgetPrintSheetProps {
  title: string;
  html: string;
  onClose: () => void;
}

export const BudgetPrintSheet: React.FC<BudgetPrintSheetProps> = ({ title, html, onClose }) => {
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
            Print / Save
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

export { buildBudgetPrintHtml };
