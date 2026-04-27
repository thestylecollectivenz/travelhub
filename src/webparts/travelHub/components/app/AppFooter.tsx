import * as React from 'react';
import styles from './AppFooter.module.css';

export interface AppFooterProps {
  onOpenTerms: () => void;
}

export const AppFooter: React.FC<AppFooterProps> = ({ onOpenTerms }) => {
  return (
    <footer className={styles.footer}>
      <span className={styles.brand}>Travel Hub</span>
      <button type="button" onClick={onOpenTerms} className={styles.linkBtn}>
        Terms and Conditions
      </button>
    </footer>
  );
};
