import * as React from 'react';
import { MobileBrandHeader } from './MobileBrandHeader';
import styles from './MobileSubpageHeader.module.css';

export interface MobileSubpageHeaderProps {
  title: string;
  subtitle?: string;
  onBack: () => void;
  trailing?: React.ReactNode;
}

/** Shared Trip Leopard brand header + shell-style Back for Explore / Saved / Near-you subpages. */
export const MobileSubpageHeader: React.FC<MobileSubpageHeaderProps> = ({
  title,
  subtitle,
  onBack,
  trailing
}) => {
  return (
    <MobileBrandHeader
      safeAreaTop={false}
      title={title}
      subtitle={subtitle}
      actions={trailing}
      navRow={
        <button type="button" className={styles.backLink} onClick={onBack} aria-label="Back">
          <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden>
            <path
              d="M10 3L5 8l5 5"
              stroke="currentColor"
              strokeWidth="1.8"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
          Back
        </button>
      }
    />
  );
};
