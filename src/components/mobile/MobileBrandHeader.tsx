import * as React from 'react';
import styles from './MobileBrandHeader.module.css';

export interface MobileBrandHeaderProps {
  actions?: React.ReactNode;
  navRow?: React.ReactNode;
  /** Primary heading under the back link (page name, or trip name on detail views). */
  title?: string;
  /** Short page description under the primary heading. */
  subtitle?: string;
  /** Smaller trip name shown under the subtitle on tab pages. */
  tripName?: string;
  /** When true (default), apply safe-area top padding. Set false when already inside a padded scroll shell. */
  safeAreaTop?: boolean;
}

export const MobileBrandHeader: React.FC<MobileBrandHeaderProps> = ({
  actions,
  navRow,
  title,
  subtitle,
  tripName,
  safeAreaTop = true
}) => {
  return (
    <header className={`${styles.root} ${safeAreaTop ? '' : styles.rootEmbedded}`.trim()}>
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
      {tripName ? <p className={styles.tripName}>{tripName}</p> : null}
    </header>
  );
};
