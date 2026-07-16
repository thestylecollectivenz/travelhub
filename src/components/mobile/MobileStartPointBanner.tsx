import * as React from 'react';
import type { StoredStartPoint } from '../../utils/locationStartPointStorage';
import { startPointKey } from '../../utils/locationStartPointStorage';
import { MobileStartPointActions } from './MobileStartPointActions';
import styles from './MobileStartPointBanner.module.css';

function IconBed(): React.ReactElement {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden>
      <path d="M3 18v-6a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2v6" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
      <path d="M3 14h18M7 10V8a2 2 0 0 1 2-2h3a2 2 0 0 1 2 2v2" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
    </svg>
  );
}

function IconGps(): React.ReactElement {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden>
      <circle cx="12" cy="12" r="3" stroke="currentColor" strokeWidth="1.6" />
      <path d="M12 2v3M12 19v3M2 12h3M19 12h3" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
    </svg>
  );
}

export interface MobileStartPointBannerProps {
  nearLabel: string;
  isGps?: boolean;
  onChangeStartingPoint?: () => void;
  onResetStartingPoint?: () => void;
  onUndoStartingPoint?: () => void;
  canUndoStartingPoint?: boolean;
  isCustomStartingPoint?: boolean;
  accommodationLabel?: string;
  /** Accommodation start shown first in Other starting points when a custom start is active. */
  accommodationStart?: StoredStartPoint | null;
  savedStarts?: StoredStartPoint[];
  onSelectSavedStart?: (point: StoredStartPoint) => void;
  /** Delete a saved start that has no linked saved entries. */
  onRemoveSavedStart?: (point: StoredStartPoint) => void;
  activeStart?: StoredStartPoint | null;
  /** When false, hide the Other starting points column (e.g. GPS mode). */
  showOtherStarts?: boolean;
}

/**
 * Shared “Showing places near …” banner used on Location Info, Explore, and Saved Places.
 * Two columns on wider layouts: current start + change controls | other starting points.
 */
export const MobileStartPointBanner: React.FC<MobileStartPointBannerProps> = ({
  nearLabel,
  isGps,
  onChangeStartingPoint,
  onResetStartingPoint,
  onUndoStartingPoint,
  canUndoStartingPoint,
  isCustomStartingPoint,
  accommodationLabel,
  accommodationStart,
  savedStarts,
  onSelectSavedStart,
  onRemoveSavedStart,
  activeStart,
  showOtherStarts = true
}) => {
  const activeKey = activeStart ? startPointKey(activeStart) : '';
  const accomKey = accommodationStart ? startPointKey(accommodationStart) : '';

  const others = React.useMemo(() => {
    const list: StoredStartPoint[] = [];
    const seen = new Set<string>();
    const push = (p: StoredStartPoint | null | undefined): void => {
      if (!p) return;
      const key = startPointKey(p);
      if (activeKey && key === activeKey) return;
      if (seen.has(key)) return;
      seen.add(key);
      list.push(p);
    };
    // Accommodation first once a second (custom) start exists.
    if (isCustomStartingPoint) push(accommodationStart);
    for (const p of savedStarts || []) {
      if (accomKey && startPointKey(p) === accomKey) continue;
      push(p);
    }
    return list;
  }, [accommodationStart, accomKey, activeKey, isCustomStartingPoint, savedStarts]);

  return (
    <div className={styles.startBanner}>
      <div className={styles.startBannerMain}>
        <span className={styles.startBannerIcon} aria-hidden>
          {isGps ? <IconGps /> : <IconBed />}
        </span>
        <div className={styles.startBannerBody}>
          <p className={styles.startBannerText}>
            Showing places near <strong>{nearLabel}</strong>
          </p>
          {!isGps ? (
            <MobileStartPointActions
              onChangeStartingPoint={onChangeStartingPoint}
              onResetStartingPoint={onResetStartingPoint}
              onUndoStartingPoint={onUndoStartingPoint}
              canUndoStartingPoint={canUndoStartingPoint}
              isCustomStartingPoint={isCustomStartingPoint}
              accommodationLabel={accommodationLabel}
              changeClassName={styles.startBannerLink}
              mutedClassName={styles.startBannerMuted}
              actionsClassName={styles.startBannerActions}
              undoClassName={styles.startBannerUndo}
              hideSavedStarts
            />
          ) : null}
        </div>
      </div>
      {showOtherStarts && !isGps ? (
        <div className={styles.startBannerSide}>
          <p className={styles.startBannerSideLabel}>Other starting points</p>
          {others.length && onSelectSavedStart ? (
            <ul className={styles.startBannerSideList}>
              {others.map((p) => (
                <li key={startPointKey(p)} className={styles.startBannerSideItem}>
                  <button
                    type="button"
                    className={styles.startBannerSideBtn}
                    onClick={() => onSelectSavedStart(p)}
                  >
                    Near {p.label}
                  </button>
                  {onRemoveSavedStart ? (
                    <button
                      type="button"
                      className={styles.startBannerSideX}
                      aria-label={`Remove starting point ${p.label}`}
                      title="Remove starting point"
                      onClick={() => onRemoveSavedStart(p)}
                    >
                      ×
                    </button>
                  ) : null}
                </li>
              ))}
            </ul>
          ) : (
            <p className={styles.startBannerSideEmpty}>None yet — change starting point to add one.</p>
          )}
        </div>
      ) : null}
    </div>
  );
};
