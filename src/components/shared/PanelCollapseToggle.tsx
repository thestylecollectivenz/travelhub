import * as React from 'react';
import styles from './PanelCollapseToggle.module.css';

export interface PanelCollapseToggleProps {
  expanded: boolean;
  onToggle: () => void;
  expandTitle: string;
  collapseTitle: string;
}

export const PanelCollapseToggle: React.FC<PanelCollapseToggleProps> = ({
  expanded,
  onToggle,
  expandTitle,
  collapseTitle
}) => {
  return (
    <button
      type="button"
      className={styles.toggle}
      onClick={onToggle}
      title={expanded ? collapseTitle : expandTitle}
      aria-label={expanded ? collapseTitle : expandTitle}
      aria-expanded={expanded}
    >
      <svg width={16} height={16} viewBox="0 0 16 16" fill="none" aria-hidden>
        {expanded ? (
          <path
            d="M2.5 8h11M5 5.5 2.5 8 5 10.5M11 5.5 13.5 8 11 10.5"
            stroke="currentColor"
            strokeWidth="1.2"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        ) : (
          <path
            d="M2.5 8h11M5 5.5 8 2.5 10.5 8M11 5.5 8 10.5 13.5 8"
            stroke="currentColor"
            strokeWidth="1.2"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        )}
      </svg>
    </button>
  );
};
