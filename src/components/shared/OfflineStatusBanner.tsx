import * as React from 'react';
import { useOfflineStatus } from '../../context/OfflineStatusContext';
import styles from './OfflineStatusBanner.module.css';

function formatCachedAt(iso: string | null): string {
  if (!iso) return '';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  return d.toLocaleString('en-NZ', {
    day: 'numeric',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit'
  });
}

/** Non-blocking banner — edit controls stay visible; writes are blocked elsewhere. */
export const OfflineStatusBanner: React.FC = () => {
  const { isOffline, viewingCachedTrip, lastCachedAt } = useOfflineStatus();
  if (!isOffline && !viewingCachedTrip) return null;

  const cachedLabel = formatCachedAt(lastCachedAt);
  const message = isOffline
    ? cachedLabel
      ? `Offline — viewing last saved trip (${cachedLabel}). Editing isn’t available until you’re back online.`
      : 'Offline — viewing last saved trip when available. Editing isn’t available until you’re back online.'
    : cachedLabel
      ? `Showing cached trip data from ${cachedLabel}. Reconnect to refresh.`
      : 'Showing cached trip data. Reconnect to refresh.';

  return (
    <div className={styles.banner} role="status" aria-live="polite">
      {message}
    </div>
  );
};
