import * as React from 'react';
import { loadNearYouSavedPlaces, removeNearYouSavedPlace, type NearYouSavedPlace } from '../../utils/nearYouSavedPlaces';
import { placeQueryDirectionsUrl } from '../../utils/googleMapsLink';
import styles from './MobileHome.module.css';

export interface MobileHomeSavedSpotsProps {
  onOpenAll?: () => void;
  compact?: boolean;
}

export const MobileHomeSavedSpots: React.FC<MobileHomeSavedSpotsProps> = ({ onOpenAll, compact = false }) => {
  const [rows, setRows] = React.useState<NearYouSavedPlace[]>([]);

  const refresh = React.useCallback(() => {
    setRows(loadNearYouSavedPlaces());
  }, []);

  React.useEffect(() => {
    refresh();
    const handler = (): void => refresh();
    window.addEventListener('travelhub-near-you-saved-changed', handler);
    return () => window.removeEventListener('travelhub-near-you-saved-changed', handler);
  }, [refresh]);

  if (!rows.length) return null;

  const visible = compact ? rows.slice(0, 6) : rows;

  return (
    <section className={styles.savedSpotsSection}>
      <div className={styles.sectionHead}>
        <h2 className={styles.sectionTitle}>Saved spots</h2>
        {onOpenAll ? (
          <button type="button" className={styles.sectionLink} onClick={onOpenAll}>
            See all
          </button>
        ) : null}
      </div>
      <p className={styles.savedSpotsHint}>Places you saved from Near you on this device.</p>
      <div className={styles.savedSpotsList}>
        {visible.map((row) => {
          const href = row.mapsUrl || placeQueryDirectionsUrl(row.name) || row.websiteUrl;
          return (
            <article key={row.id} className={styles.savedSpotCard}>
              <div className={styles.savedSpotMain}>
                <strong className={styles.savedSpotName}>{row.name}</strong>
                {row.note ? <p className={styles.savedSpotNote}>{row.note}</p> : null}
                <p className={styles.savedSpotMeta}>{new Date(row.savedAt).toLocaleString('en-NZ', { day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit' })}</p>
              </div>
              <div className={styles.savedSpotActions}>
                {href ? (
                  <a className={styles.savedSpotBtn} href={href} target="_blank" rel="noopener noreferrer">
                    Open
                  </a>
                ) : null}
                <button type="button" className={styles.savedSpotBtn} onClick={() => removeNearYouSavedPlace(row.id)}>
                  Remove
                </button>
              </div>
            </article>
          );
        })}
      </div>
    </section>
  );
};
