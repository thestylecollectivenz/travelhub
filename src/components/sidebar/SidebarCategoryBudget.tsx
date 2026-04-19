import * as React from 'react';
import { useTripWorkspace } from '../../context/TripWorkspaceContext';
import { MOCK_ITINERARY_ENTRIES } from '../../mocks/tripMock';
import { BUDGET_CATEGORY_ORDER, formatNZD, sumByCategory, type BudgetCategoryKey } from '../../utils/financialUtils';
import styles from './SidebarCategoryBudget.module.css';

function IconFlights({ className }: { className?: string }): React.ReactElement {
  return (
    <svg className={className} viewBox="0 0 24 24" width={14} height={14} fill="none" aria-hidden>
      <path
        d="M4 14 20 8M6 16l2-4M14 8l2 4M8 12l8-3"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function IconAccommodation({ className }: { className?: string }): React.ReactElement {
  return (
    <svg className={className} viewBox="0 0 24 24" width={14} height={14} fill="none" aria-hidden>
      <path
        d="M5 20V10l7-5 7 5v10M9 20v-6h6v6"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function IconFood({ className }: { className?: string }): React.ReactElement {
  return (
    <svg className={className} viewBox="0 0 24 24" width={14} height={14} fill="none" aria-hidden>
      <path d="M6 4v8M6 12c0 2 1.5 4 4 4s4-2 4-4V4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
      <path d="M14 8h6M17 5v6" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
    </svg>
  );
}

function IconActivities({ className }: { className?: string }): React.ReactElement {
  return (
    <svg className={className} viewBox="0 0 24 24" width={14} height={14} fill="none" aria-hidden>
      <circle cx="12" cy="12" r="7" stroke="currentColor" strokeWidth="1.5" />
      <circle cx="12" cy="12" r="2" fill="currentColor" />
    </svg>
  );
}

function IconTransport({ className }: { className?: string }): React.ReactElement {
  return (
    <svg className={className} viewBox="0 0 24 24" width={14} height={14} fill="none" aria-hidden>
      <rect x="4" y="8" width="14" height="7" rx="1.5" stroke="currentColor" strokeWidth="1.5" />
      <path d="M8 8V6M16 8V6M6 18v2M18 18v2" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
    </svg>
  );
}

function IconOther({ className }: { className?: string }): React.ReactElement {
  return (
    <svg className={className} viewBox="0 0 24 24" width={14} height={14} fill="none" aria-hidden>
      <path
        d="M8 6h12v12H8zM4 10h12v12H4z"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinejoin="round"
      />
    </svg>
  );
}

const CATEGORY_ICONS: Record<BudgetCategoryKey, React.FC<{ className?: string }>> = {
  Flights: IconFlights,
  Accommodation: IconAccommodation,
  'Food & Dining': IconFood,
  Activities: IconActivities,
  Transport: IconTransport,
  Other: IconOther
};

export const SidebarCategoryBudget: React.FC = () => {
  const { trip } = useTripWorkspace();

  const entries = React.useMemo(
    () => MOCK_ITINERARY_ENTRIES.filter((e) => e.tripId === trip.id),
    [trip.id]
  );

  const totals = React.useMemo(() => sumByCategory(entries), [entries]);

  return (
    <section className={styles.section} aria-label="Trip budget by category">
      <h2 className={styles.heading}>Trip budget</h2>
      <div className={styles.body}>
        {BUDGET_CATEGORY_ORDER.map((key) => {
          const amount = totals[key] ?? 0;
          const Icon = CATEGORY_ICONS[key];
          const isZero = amount === 0;
          return (
            <div key={key} className={styles.row}>
              <div className={styles.rowLeft}>
                <Icon className={styles.icon} />
                <span className={styles.label}>{key}</span>
              </div>
              <span className={`${styles.total} ${isZero ? styles.totalZero : ''}`}>
                {isZero ? '—' : formatNZD(amount)}
              </span>
            </div>
          );
        })}
      </div>
    </section>
  );
};
