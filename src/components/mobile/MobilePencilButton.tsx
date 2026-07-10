import * as React from 'react';
import styles from './MobilePencilButton.module.css';

export interface MobilePencilButtonProps {
  onClick: () => void;
  ariaLabel?: string;
  className?: string;
}

export const MobilePencilButton: React.FC<MobilePencilButtonProps> = ({ onClick, ariaLabel = 'Edit', className }) => (
  <button
    type="button"
    className={`${styles.btn} ${className || ''}`}
    onClick={onClick}
    aria-label={ariaLabel}
    title={ariaLabel}
  >
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden>
      <path
        d="M10.5 2.5 13.5 5.5 5.5 13.5H2.5v-3L10.5 2.5Z"
        stroke="currentColor"
        strokeWidth="1.3"
        strokeLinejoin="round"
      />
      <path d="M9 4l3 3" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" />
    </svg>
  </button>
);
