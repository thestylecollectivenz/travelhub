import * as React from 'react';
import type { BudgetCategoryKey } from '../../utils/financialUtils';

export interface CategoryIconProps {
  category: BudgetCategoryKey;
  size?: number;
  /** CSS color value, e.g. var(--color-sand-400) */
  color?: string;
}

function IconFlights({ className, style }: { className?: string; style?: React.CSSProperties }): React.ReactElement {
  return (
    <svg className={className} style={style} viewBox="0 0 24 24" fill="none" aria-hidden>
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

function IconAccommodation({ className, style }: { className?: string; style?: React.CSSProperties }): React.ReactElement {
  return (
    <svg className={className} style={style} viewBox="0 0 24 24" fill="none" aria-hidden>
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

function IconFood({ className, style }: { className?: string; style?: React.CSSProperties }): React.ReactElement {
  return (
    <svg className={className} style={style} viewBox="0 0 24 24" fill="none" aria-hidden>
      <path d="M6 4v8M6 12c0 2 1.5 4 4 4s4-2 4-4V4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
      <path d="M14 8h6M17 5v6" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
    </svg>
  );
}

function IconActivities({ className, style }: { className?: string; style?: React.CSSProperties }): React.ReactElement {
  return (
    <svg className={className} style={style} viewBox="0 0 24 24" fill="none" aria-hidden>
      <circle cx="12" cy="12" r="7" stroke="currentColor" strokeWidth="1.5" />
      <circle cx="12" cy="12" r="2" fill="currentColor" />
    </svg>
  );
}

function IconTransport({ className, style }: { className?: string; style?: React.CSSProperties }): React.ReactElement {
  return (
    <svg className={className} style={style} viewBox="0 0 24 24" fill="none" aria-hidden>
      <rect x="4" y="8" width="14" height="7" rx="1.5" stroke="currentColor" strokeWidth="1.5" />
      <path d="M8 8V6M16 8V6M6 18v2M18 18v2" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
    </svg>
  );
}

function IconOther({ className, style }: { className?: string; style?: React.CSSProperties }): React.ReactElement {
  return (
    <svg className={className} style={style} viewBox="0 0 24 24" fill="none" aria-hidden>
      <path
        d="M8 6h12v12H8zM4 10h12v12H4z"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinejoin="round"
      />
    </svg>
  );
}

const ICONS: Record<BudgetCategoryKey, React.FC<{ className?: string; style?: React.CSSProperties }>> = {
  Flights: IconFlights,
  Accommodation: IconAccommodation,
  'Food & Dining': IconFood,
  Activities: IconActivities,
  Transport: IconTransport,
  Other: IconOther
};

export const CategoryIcon: React.FC<CategoryIconProps> = ({ category, size = 14, color = 'var(--color-sand-400)' }) => {
  const Icon = ICONS[category];
  const style: React.CSSProperties = {
    color,
    width: size,
    height: size,
    flexShrink: 0,
    display: 'block'
  };
  return <Icon style={style} />;
};
