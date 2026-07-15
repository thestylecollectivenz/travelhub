import * as React from 'react';
import type { StoredStartPoint } from '../../utils/locationStartPointStorage';
import { startPointKey } from '../../utils/locationStartPointStorage';
import styles from './MobileStartPointActions.module.css';

function IconUndo(): React.ReactElement {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden>
      <path
        d="M9 7 5 11l4 4"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M5 11h9a5 5 0 0 1 0 10h-2"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

export interface MobileStartPointActionsProps {
  onChangeStartingPoint?: () => void;
  onResetStartingPoint?: () => void;
  onUndoStartingPoint?: () => void;
  canUndoStartingPoint?: boolean;
  isCustomStartingPoint?: boolean;
  accommodationLabel?: string;
  /** Saved custom starts (map picks) for quick re-select. */
  savedStarts?: StoredStartPoint[];
  onSelectSavedStart?: (point: StoredStartPoint) => void;
  activeStart?: StoredStartPoint | null;
  changeClassName?: string;
  resetClassName?: string;
  mutedClassName?: string;
  actionsClassName?: string;
  undoClassName?: string;
}

/** Shared change / near-accommodation / saved starts / undo controls. */
export const MobileStartPointActions: React.FC<MobileStartPointActionsProps> = ({
  onChangeStartingPoint,
  onResetStartingPoint,
  onUndoStartingPoint,
  canUndoStartingPoint,
  isCustomStartingPoint,
  accommodationLabel,
  savedStarts,
  onSelectSavedStart,
  activeStart,
  changeClassName,
  resetClassName,
  mutedClassName,
  actionsClassName,
  undoClassName
}) => {
  const stay = (accommodationLabel || '').trim() || 'accommodation';
  const activeKey = activeStart ? startPointKey(activeStart) : '';
  const others = (savedStarts || []).filter((p) => {
    if (activeKey && startPointKey(p) === activeKey) return false;
    return true;
  });

  return (
    <div className={`${styles.root} ${actionsClassName || ''}`.trim()}>
      <div className={styles.row}>
        {onChangeStartingPoint ? (
          <button type="button" className={changeClassName || styles.link} onClick={onChangeStartingPoint}>
            Change starting point
          </button>
        ) : (
          <span className={mutedClassName || styles.muted}>Change starting point</span>
        )}
        {isCustomStartingPoint && onResetStartingPoint ? (
          <button
            type="button"
            className={resetClassName || changeClassName || styles.link}
            onClick={onResetStartingPoint}
          >
            Near {stay}
          </button>
        ) : null}
        {canUndoStartingPoint && onUndoStartingPoint ? (
          <button
            type="button"
            className={undoClassName || changeClassName || styles.link}
            onClick={onUndoStartingPoint}
            aria-label="Undo starting point change"
            title="Undo last change"
          >
            <IconUndo />
          </button>
        ) : null}
      </div>
      {others.length && onSelectSavedStart ? (
        <div className={styles.savedRow} role="list" aria-label="Saved starting points">
          {others.map((p) => (
            <button
              key={startPointKey(p)}
              type="button"
              role="listitem"
              className={styles.savedChip}
              onClick={() => onSelectSavedStart(p)}
              title={`Start from ${p.label}`}
            >
              Near {p.label}
            </button>
          ))}
        </div>
      ) : null}
    </div>
  );
};
