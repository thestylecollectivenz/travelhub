import * as React from 'react';
import { SOLUTION_VERSION } from '../../appVersion';
import styles from './IpadLandscapePlaceholder.module.css';

export interface IpadLandscapePlaceholderProps {
  /** Home (trip list) vs inside a trip workspace. */
  context: 'home' | 'trip';
  tripTitle?: string;
  onBack?: () => void;
}

export const IpadLandscapePlaceholder: React.FC<IpadLandscapePlaceholderProps> = ({
  context,
  tripTitle,
  onBack
}) => {
  const heading = context === 'trip' && tripTitle?.trim() ? tripTitle.trim() : 'Travel Hub';

  return (
    <div className={styles.root} role="main">
      <header className={styles.header}>
        {context === 'trip' && onBack ? (
          <button type="button" className={styles.backBtn} onClick={onBack}>
            ← All trips
          </button>
        ) : (
          <span className={styles.headerSpacer} aria-hidden />
        )}
        <h1 className={styles.title}>{heading}</h1>
        <span className={styles.headerSpacer} aria-hidden />
      </header>

      <div className={styles.body}>
        <div className={styles.iconWrap} aria-hidden>
          <svg width="56" height="56" viewBox="0 0 56 56" fill="none">
            <rect x="8" y="14" width="40" height="28" rx="4" stroke="currentColor" strokeWidth="2" />
            <path d="M20 42h16" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
            <path
              d="M28 8v6M22 10l6 4 6-4"
              stroke="currentColor"
              strokeWidth="1.8"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        </div>
        <h2 className={styles.heading}>iPad landscape view coming soon</h2>
        <p className={styles.lead}>
          A touch-first landscape layout for iPad is in development. It will mirror the updated desktop experience
          without mouse-only interactions.
        </p>
        <p className={styles.hint}>
          <strong>For now, rotate to portrait</strong> to use Travel Hub on your iPad — the same app-style interface as
          iPhone, optimised for tablet width.
        </p>
      </div>

      <footer className={styles.footer}>
        <span className={styles.version}>v{SOLUTION_VERSION}</span>
      </footer>
    </div>
  );
};
