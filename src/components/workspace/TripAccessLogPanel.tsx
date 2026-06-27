import * as React from 'react';
import { useSpContext } from '../../context/SpContext';
import { TripAccessLogService, type TripAccessLogEntry } from '../../services/TripAccessLogService';
import styles from './TripMembersPanel.module.css';

export interface TripAccessLogPanelProps {
  tripId: string;
  isOpen: boolean;
  onClose: () => void;
}

function formatWhen(iso: string): string {
  if (!iso) return '';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleString();
}

export const TripAccessLogPanel: React.FC<TripAccessLogPanelProps> = ({ tripId, isOpen, onClose }) => {
  const spContext = useSpContext();
  const service = React.useMemo(() => new TripAccessLogService(spContext), [spContext]);
  const [rows, setRows] = React.useState<TripAccessLogEntry[]>([]);
  const [loading, setLoading] = React.useState(false);

  React.useEffect(() => {
    if (!isOpen || !tripId) return;
    setLoading(true);
    void service
      .getForTrip(tripId)
      .then(setRows)
      .catch(() => setRows([]))
      .then(() => setLoading(false));
  }, [isOpen, tripId, service]);

  if (!isOpen) return null;

  return (
    <div className={styles.backdrop} role="dialog" aria-modal="true" aria-label="Trip access log" onClick={onClose}>
      <div className={styles.panel} onClick={(e) => e.stopPropagation()}>
        <header className={styles.header}>
          <h2 className={styles.title}>Access log</h2>
          <button type="button" className={styles.closeBtn} onClick={onClose} aria-label="Close">
            ×
          </button>
        </header>
        <p className={styles.hint}>Who opened this trip and which areas they viewed (most recent first).</p>
        {loading ? <p className={styles.hint}>Loading…</p> : null}
        {!loading && rows.length === 0 ? <p className={styles.hint}>No access entries yet.</p> : null}
        <ul className={styles.list}>
          {rows.map((row) => (
            <li key={row.id} className={styles.row}>
              <div className={styles.memberMeta}>
                <strong>{row.userDisplayName || row.userEmail}</strong>
                <span className={styles.email}>{row.userEmail}</span>
                <span className={styles.email}>
                  {row.action}
                  {row.resource ? ` · ${row.resource}` : ''}
                </span>
                <span className={styles.email}>{formatWhen(row.accessedAt)}</span>
              </div>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
};
