import * as React from 'react';
import styles from './MobileSubpageHeader.module.css';

export interface MobileSubpageHeaderProps {
  title: string;
  subtitle?: string;
  onBack: () => void;
  trailing?: React.ReactNode;
}

/** Shared back + title header for Explore / Saved / Near-you style subpages. */
export const MobileSubpageHeader: React.FC<MobileSubpageHeaderProps> = ({
  title,
  subtitle,
  onBack,
  trailing
}) => {
  return (
    <header className={styles.top}>
      <button type="button" className={styles.back} onClick={onBack} aria-label="Back">
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" aria-hidden>
          <path d="M15 6 9 12l6 6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </button>
      <div className={styles.topMain}>
        <h1 className={styles.title}>{title}</h1>
        {subtitle ? <p className={styles.sub}>{subtitle}</p> : null}
      </div>
      {trailing ? <div className={styles.trailing}>{trailing}</div> : <span className={styles.spacer} aria-hidden />}
    </header>
  );
};
