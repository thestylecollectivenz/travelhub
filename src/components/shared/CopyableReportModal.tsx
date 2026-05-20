import * as React from 'react';
import styles from './CopyableReportModal.module.css';

export interface CopyableReportModalProps {
  title: string;
  body: string;
  onClose: () => void;
}

/** User-facing report dialog with copy-to-clipboard support. */
export const CopyableReportModal: React.FC<CopyableReportModalProps> = ({ title, body, onClose }) => {
  const [copied, setCopied] = React.useState(false);

  const handleCopy = React.useCallback(() => {
    void navigator.clipboard.writeText(body).then(
      () => {
        setCopied(true);
        window.setTimeout(() => setCopied(false), 2000);
      },
      () => undefined
    );
  }, [body]);

  return (
    <div className={styles.backdrop} role="presentation" aria-label={title}>
      <div
        className={styles.dialog}
        role="dialog"
        aria-modal="true"
        aria-labelledby="copyable-report-title"
        onClick={(e) => e.stopPropagation()}
      >
        <h2 id="copyable-report-title" className={styles.title}>
          {title}
        </h2>
        <textarea className={styles.body} readOnly value={body} aria-label="Report text" />
        <div className={styles.actions}>
          <button type="button" className={styles.primaryBtn} onClick={handleCopy}>
            {copied ? 'Copied' : 'Copy to clipboard'}
          </button>
          <button type="button" className={styles.secondaryBtn} onClick={onClose}>
            Close
          </button>
        </div>
      </div>
    </div>
  );
};
