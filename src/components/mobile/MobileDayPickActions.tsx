import * as React from 'react';
import styles from './MobileDayPickActions.module.css';

export type DayPickOption = {
  dayId: string;
  label: string;
};

export interface MobileDayPickActionsProps {
  open: boolean;
  title: string;
  days: DayPickOption[];
  onPick: (dayId: string) => void;
  onCancel: () => void;
}

/** Inline day chooser when a place spans multiple trip days (no modal). */
export const MobileDayPickActions: React.FC<MobileDayPickActionsProps> = ({
  open,
  title,
  days,
  onPick,
  onCancel
}) => {
  if (!open || !days.length) return null;
  return (
    <div className={styles.root} role="group" aria-label={title}>
      <p className={styles.title}>{title}</p>
      <div className={styles.list}>
        {days.map((d) => (
          <button key={d.dayId} type="button" className={styles.dayBtn} onClick={() => onPick(d.dayId)}>
            {d.label}
          </button>
        ))}
      </div>
      <button type="button" className={styles.cancel} onClick={onCancel}>
        Cancel
      </button>
    </div>
  );
};
