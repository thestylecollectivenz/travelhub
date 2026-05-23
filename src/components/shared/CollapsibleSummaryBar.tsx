import * as React from 'react';
import styles from './CollapsibleSummaryBar.module.css';

export interface CollapsibleSummaryBarProps {
  expanded: boolean;
  onToggle: () => void;
  collapsedSummary: string;
  /** Uppercase section title shown when collapsed (e.g. Locations, Day breakdown). */
  collapsedTitle?: string;
  ariaLabel: string;
  className?: string;
  children?: React.ReactNode;
}

/** Financials-style strip: one-line summary when collapsed, optional body when expanded. */
export const CollapsibleSummaryBar: React.FC<CollapsibleSummaryBarProps> = ({
  expanded,
  onToggle,
  collapsedSummary,
  collapsedTitle,
  ariaLabel,
  className,
  children
}) => {
  return (
    <div
      className={[styles.strip, !expanded ? styles.stripCollapsed : '', className].filter(Boolean).join(' ')}
      aria-label={ariaLabel}
    >
      {expanded ? (
        children
      ) : (
        <div className={styles.collapsedRow}>
          {collapsedTitle ? <span className={styles.collapsedTitle}>{collapsedTitle}</span> : null}
          <span className={styles.collapsedSummary}>{collapsedSummary}</span>
        </div>
      )}
      <button
        type="button"
        className={styles.toggleButton}
        onClick={onToggle}
        aria-label={expanded ? `Collapse ${ariaLabel}` : `Expand ${ariaLabel}`}
        aria-expanded={expanded}
      >
        <svg viewBox="0 0 16 16" width={14} height={14} fill="none" aria-hidden>
          {expanded ? (
            <path d="M4 9.5 8 6l4 3.5" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
          ) : (
            <path d="M4 6.5 8 10l4-3.5" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
          )}
        </svg>
      </button>
    </div>
  );
};

