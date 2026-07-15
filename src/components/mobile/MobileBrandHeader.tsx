import * as React from 'react';
import { MobileHeaderAccessActions } from './MobileHeaderAccessActions';
import styles from './MobileBrandHeader.module.css';

export interface MobileBrandHeaderProps {
  /** Extra trailing control(s) after the standard access + gear actions. */
  actions?: React.ReactNode;
  navRow?: React.ReactNode;
  /** Primary heading under the back link (page name). */
  title?: string;
  /** Short page description under the primary heading. */
  subtitle?: string;
  /** Trip name in the trip summary row (tabs) or alone on detail views. */
  tripName?: string;
  /** Trip date range under the trip name (tab pages only). */
  tripDates?: string;
  /** Trip hero thumbnail; when set (including null), shows thumb / placeholder. */
  tripHeroSrc?: string | null;
  /** When true (default), apply safe-area top padding. Set false when already inside a padded scroll shell. */
  safeAreaTop?: boolean;
  /** Override access trip id for this header instance. */
  accessTripId?: string;
  /** Override open-access handler for this header instance. */
  onOpenAccess?: () => void;
  /** When true, hide the standard access avatar + gear. */
  hideAccessActions?: boolean;
}

export const MobileBrandHeader: React.FC<MobileBrandHeaderProps> = ({
  actions,
  navRow,
  title,
  subtitle,
  tripName,
  tripDates,
  tripHeroSrc,
  safeAreaTop = true,
  accessTripId,
  onOpenAccess,
  hideAccessActions = false
}) => {
  const showTripRow = Boolean(tripName || tripDates || tripHeroSrc !== undefined);

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
        <div className={styles.topBarActions}>
          {hideAccessActions ? null : (
            <MobileHeaderAccessActions accessTripId={accessTripId} onOpenAccess={onOpenAccess} />
          )}
          {actions}
        </div>
      </div>
      {navRow ? <div className={styles.navRow}>{navRow}</div> : null}
      {title ? <h2 className={styles.pageTitle}>{title}</h2> : null}
      {subtitle ? <p className={styles.pageSub}>{subtitle}</p> : null}
      {showTripRow ? (
        tripHeroSrc !== undefined || tripDates ? (
          <div className={styles.tripHeader}>
            <div className={styles.tripMeta}>
              {tripName ? <p className={styles.tripName}>{tripName}</p> : null}
              {tripDates ? <p className={styles.tripDates}>{tripDates}</p> : null}
            </div>
            {tripHeroSrc !== undefined ? (
              tripHeroSrc ? (
                <img src={tripHeroSrc} alt="" className={styles.heroThumb} />
              ) : (
                <div className={styles.heroThumbPlaceholder} aria-hidden />
              )
            ) : null}
          </div>
        ) : tripName ? (
          <p className={styles.tripNameSolo}>{tripName}</p>
        ) : null
      ) : null}
    </header>
  );
};
