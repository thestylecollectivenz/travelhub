import * as React from 'react';
import { useTripWorkspace } from '../../context/TripWorkspaceContext';
import { useConfig } from '../../context/ConfigContext';
import { avgPerDay, formatCurrency, sumByPaymentStatus } from '../../utils/financialUtils';
import styles from './TripStatsStrip.module.css';

function IconWallet({ className }: { className?: string }): React.ReactElement {
  return (
    <svg className={className} viewBox="0 0 24 24" width={20} height={20} fill="none" aria-hidden>
      <path
        d="M4 7a3 3 0 0 1 3-3h10a3 3 0 0 1 3 3v10a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V7Z"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinejoin="round"
      />
      <path d="M4 10h16v3H4v-3Z" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round" />
      <circle cx="16" cy="11.5" r="0.75" fill="currentColor" />
    </svg>
  );
}

function IconCheckCircle({ className }: { className?: string }): React.ReactElement {
  return (
    <svg className={className} viewBox="0 0 24 24" width={20} height={20} fill="none" aria-hidden>
      <circle cx="12" cy="12" r="9" stroke="currentColor" strokeWidth="1.5" />
      <path d="M8 12.5 11 15.5 16 9.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function IconClock({ className }: { className?: string }): React.ReactElement {
  return (
    <svg className={className} viewBox="0 0 24 24" width={20} height={20} fill="none" aria-hidden>
      <circle cx="12" cy="12" r="9" stroke="currentColor" strokeWidth="1.5" />
      <path d="M12 7v6l4 2" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function IconCalendar({ className }: { className?: string }): React.ReactElement {
  return (
    <svg className={className} viewBox="0 0 24 24" width={20} height={20} fill="none" aria-hidden>
      <rect x="4" y="6" width="16" height="14" rx="2" stroke="currentColor" strokeWidth="1.5" />
      <path d="M8 4v4M16 4v4M4 11h16" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
    </svg>
  );
}

/**
 * Private workspace budget summary (hidden in shared view when that mode is wired in Phase 3+).
 */
export const TripStatsStrip: React.FC = () => {
  const { trip, localEntries, tripDays, convertToHomeCurrency } = useTripWorkspace();
  const { config } = useConfig();
  const [collapsed, setCollapsed] = React.useState(false);

  const entries = React.useMemo(
    () => (trip ? localEntries.filter((e) => e.tripId === trip.id) : []),
    [localEntries, trip]
  );

  const totalBudget = sumByPaymentStatus(entries, 'all', convertToHomeCurrency);
  const spentSoFar = sumByPaymentStatus(entries, 'paid', convertToHomeCurrency);
  const remaining = sumByPaymentStatus(entries, 'unpaid', convertToHomeCurrency);
  const dayCount = tripDays.filter((d) => trip && d.tripId === trip.id).length;
  const averagePerDay = avgPerDay(totalBudget, dayCount);

  return (
    <section className={styles.strip} aria-label="Trip budget summary">
      {collapsed ? (
        <div className={styles.collapsedSummary}>
          {`Total: ${formatCurrency(totalBudget, config.homeCurrency)} · Spent: ${formatCurrency(spentSoFar, config.homeCurrency)} · Remaining: ${formatCurrency(remaining, config.homeCurrency)}`}
        </div>
      ) : (
        <>
          <div className={styles.chip}>
            <IconWallet className={`${styles.icon} ${styles.iconPrimary}`} />
            <span className={styles.value}>{formatCurrency(totalBudget, config.homeCurrency)}</span>
            <span className={styles.label}>Total Budget</span>
          </div>
          <div className={styles.chip}>
            <IconCheckCircle className={`${styles.icon} ${styles.iconPaid}`} />
            <span className={styles.value}>{formatCurrency(spentSoFar, config.homeCurrency)}</span>
            <span className={styles.label}>Spent So Far</span>
          </div>
          <div className={styles.chip}>
            <IconClock className={`${styles.icon} ${styles.iconWarning}`} />
            <span className={styles.value}>{formatCurrency(remaining, config.homeCurrency)}</span>
            <span className={styles.label}>Remaining</span>
          </div>
          <div className={styles.chip}>
            <IconCalendar className={`${styles.icon} ${styles.iconPrimary}`} />
            <span className={styles.value}>{formatCurrency(averagePerDay, config.homeCurrency)}</span>
            <span className={styles.label}>Avg Per Day</span>
          </div>
        </>
      )}
      <button
        type="button"
        className={styles.toggleButton}
        onClick={() => setCollapsed((v) => !v)}
        aria-label={collapsed ? 'Expand stats strip' : 'Collapse stats strip'}
        aria-expanded={!collapsed}
      >
        <svg viewBox="0 0 16 16" width={14} height={14} fill="none" aria-hidden>
          {collapsed ? (
            <path d="M4 6.5 8 10l4-3.5" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
          ) : (
            <path d="M4 9.5 8 6l4 3.5" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
          )}
        </svg>
      </button>
    </section>
  );
};
