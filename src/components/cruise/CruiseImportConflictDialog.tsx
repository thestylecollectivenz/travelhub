import * as React from 'react';
import styles from './CruiseImportConflictDialog.module.css';

export type CruiseImportApplyMode = 'overwrite' | 'duplicate' | 'cancel';

export interface CruiseImportConflictDialogProps {
  affectedDayCount: number;
  existingCount: number;
  onChoose: (mode: CruiseImportApplyMode) => void;
}

export const CruiseImportConflictDialog: React.FC<CruiseImportConflictDialogProps> = ({
  affectedDayCount,
  existingCount,
  onChoose
}) => {
  React.useEffect(() => {
    const onKey = (e: KeyboardEvent): void => {
      if (e.key === 'Escape') onChoose('cancel');
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onChoose]);

  return (
    <div className={styles.backdrop} role="presentation" onClick={() => onChoose('cancel')}>
      <div
        className={styles.dialog}
        role="dialog"
        aria-modal="true"
        aria-labelledby="cruise-conflict-title"
        onClick={(e) => e.stopPropagation()}
      >
        <h2 id="cruise-conflict-title" className={styles.title}>
          Cruise itinerary already imported
        </h2>
        <p className={styles.body}>
          {affectedDayCount} day{affectedDayCount === 1 ? '' : 's'} in this import already have cruise stops (
          {existingCount} existing item{existingCount === 1 ? '' : 's'}). What would you like to do?
        </p>
        <p className={styles.reminder}>
          Automatic location matching may be approximate — especially scenic days, fjords, and passages.
          Please double-check each day&apos;s title and map pin after import.
        </p>
        <ul className={styles.options}>
          <li>
            <strong>Overwrite</strong> — remove existing cruise stops on those days only, then apply the new import.
            Other trip days and non-cruise items are not changed.
          </li>
          <li>
            <strong>Duplicate</strong> — keep existing items and add the new import alongside (may create duplicates).
          </li>
          <li>
            <strong>Cancel</strong> — do not apply.
          </li>
        </ul>
        <div className={styles.actions}>
          <button type="button" className={styles.primaryBtn} onClick={() => onChoose('overwrite')}>
            Overwrite
          </button>
          <button type="button" className={styles.secondaryBtn} onClick={() => onChoose('duplicate')}>
            Duplicate
          </button>
          <button type="button" className={styles.ghostBtn} onClick={() => onChoose('cancel')}>
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
};
