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
  /** When true, do not render the saved-starts chip row (parent shows them elsewhere). */
  hideSavedStarts?: boolean;
  changeClassName?: string;
  resetClassName?: string;
  mutedClassName?: string;
  actionsClassName?: string;
  undoClassName?: string;
}

/** Shared change / near-accommodation / saved starts / undo controls. */
function IconPin(): React.ReactElement {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" aria-hidden>
      <path d="M12 21s7-4.35 7-10a7 7 0 1 0-14 0c0 5.65 7 10 7 10Z" stroke="currentColor" strokeWidth="1.7" />
      <circle cx="12" cy="11" r="2" fill="currentColor" />
    </svg>
  );
}

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
  hideSavedStarts,
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
            <IconPin /> Change starting point
          </button>
        ) : (
          <span className={mutedClassName || styles.muted}>
            <IconPin /> Change starting point
          </span>
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
      {!hideSavedStarts && others.length && onSelectSavedStart ? (
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
