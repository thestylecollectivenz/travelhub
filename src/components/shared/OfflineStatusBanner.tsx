import * as React from 'react';
import { createPortal } from 'react-dom';
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

/** Fixed portal banner — sits above mobile shells (z-index 5000). Edit drawers stay higher. */
export const OfflineStatusBanner: React.FC = () => {
  const { isOffline, viewingCachedTrip, lastCachedAt } = useOfflineStatus();
  if (!isOffline && !viewingCachedTrip) return null;

  const cachedLabel = formatCachedAt(lastCachedAt);
  const message = isOffline
    ? cachedLabel
      ? `Offline — viewing last saved data (${cachedLabel}). Editing isn’t available until you’re back online.`
      : 'Offline — viewing last saved data when available. Editing isn’t available until you’re back online.'
    : cachedLabel
      ? `Showing cached data from ${cachedLabel}. Reconnect to refresh.`
      : 'Showing cached data. Reconnect to refresh.';

  const node = (
    <div className={styles.banner} role="status" aria-live="polite">
      {message}
    </div>
  );

  if (typeof document === 'undefined') return node;
  return createPortal(node, document.body);
};
