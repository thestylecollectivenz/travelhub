import * as React from 'react';
import styles from './PaneCollapseToggle.module.css';

export interface PaneCollapseToggleProps {
  side: 'left' | 'right';
  collapsed: boolean;
  onToggle: () => void;
  ariaLabel: string;
}

export const PaneCollapseToggle: React.FC<PaneCollapseToggleProps> = ({
  side,
  collapsed,
  onToggle,
  ariaLabel
}) => (
  <button
    type="button"
    className={`${styles.toggle} ${side === 'left' ? styles.toggleLeft : styles.toggleRight}`}
    onClick={onToggle}
    aria-label={ariaLabel}
    aria-expanded={!collapsed}
  >
    <svg className={styles.icon} viewBox="0 0 16 16" fill="none" aria-hidden>
      {side === 'left' ? (
        collapsed ? (
          <path d="M6 3l5 5-5 5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
        ) : (
          <path d="M10 3L5 8l5 5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
        )
      ) : collapsed ? (
        <path d="M10 3L5 8l5 5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
      ) : (
        <path d="M6 3l5 5-5 5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
      )}
    </svg>
  </button>
);
