import * as React from 'react';

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
  changeClassName?: string;
  resetClassName?: string;
  mutedClassName?: string;
  actionsClassName?: string;
  undoClassName?: string;
}

/** Shared change / near-accommodation / undo controls for location start banners. */
export const MobileStartPointActions: React.FC<MobileStartPointActionsProps> = ({
  onChangeStartingPoint,
  onResetStartingPoint,
  onUndoStartingPoint,
  canUndoStartingPoint,
  isCustomStartingPoint,
  accommodationLabel,
  changeClassName,
  resetClassName,
  mutedClassName,
  actionsClassName,
  undoClassName
}) => {
  const stay = (accommodationLabel || '').trim() || 'accommodation';
  return (
    <div className={actionsClassName}>
      {onChangeStartingPoint ? (
        <button type="button" className={changeClassName} onClick={onChangeStartingPoint}>
          Change starting point
        </button>
      ) : (
        <span className={mutedClassName}>Change starting point</span>
      )}
      {isCustomStartingPoint && onResetStartingPoint ? (
        <button type="button" className={resetClassName || changeClassName} onClick={onResetStartingPoint}>
          Near {stay}
        </button>
      ) : null}
      {canUndoStartingPoint && onUndoStartingPoint ? (
        <button
          type="button"
          className={undoClassName || changeClassName}
          onClick={onUndoStartingPoint}
          aria-label="Undo starting point change"
          title="Undo last change"
        >
          <IconUndo />
        </button>
      ) : null}
    </div>
  );
};
