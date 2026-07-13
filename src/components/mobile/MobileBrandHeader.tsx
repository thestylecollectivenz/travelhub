import * as React from 'react';
import styles from './MobileBrandHeader.module.css';

export interface MobileBrandHeaderProps {
  actions?: React.ReactNode;
  navRow?: React.ReactNode;
  title?: string;
  subtitle?: string;
}

export const MobileBrandHeader: React.FC<MobileBrandHeaderProps> = ({ actions, navRow, title, subtitle }) => {
  return (
    <header className={styles.root}>
      <div className={styles.topBar}>
        <div className={styles.brandRow}>
          <div className={styles.pebbleMark} aria-hidden>
            <span className={styles.pebble} />
            <span className={styles.pebble} />
            <span className={styles.pebble} />
            <span className={styles.pebble} />
          </div>
          <h1 className={styles.brandName}>Trip Leopard</h1>
        </div>
        {actions ? <div className={styles.topBarActions}>{actions}</div> : null}
      </div>
      {navRow ? <div className={styles.navRow}>{navRow}</div> : null}
      {title ? <h2 className={styles.pageTitle}>{title}</h2> : null}
      {subtitle ? <p className={styles.pageSub}>{subtitle}</p> : null}
    </header>
  );
};
