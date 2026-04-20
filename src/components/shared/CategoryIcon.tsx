import * as React from 'react';

export interface CategoryIconProps {
  category: string;
  size?: number;
  color?: string;
}

export const CategoryIcon: React.FC<CategoryIconProps> = ({ category, size = 16, color = 'currentColor' }) => {
  const common = {
    stroke: color,
    strokeWidth: 1.5,
    strokeLinecap: 'round' as const,
    strokeLinejoin: 'round' as const
  };

  const style: React.CSSProperties = {
    width: size,
    height: size,
    flexShrink: 0,
    display: 'block'
  };

  switch (category) {
    case 'Flights':
      return (
        <svg viewBox="0 0 16 16" fill="none" aria-hidden style={style}>
          <path d="M1.5 8.5 14.5 6.5M6.2 7.8 4.5 4.5M7.8 7.4 9.5 4.2M5.8 9l1.2 2.4" {...common} />
        </svg>
      );
    case 'Accommodation':
      return (
        <svg viewBox="0 0 16 16" fill="none" aria-hidden style={style}>
          <rect x="1.5" y="7.5" width="13" height="3.5" rx="0.8" {...common} />
          <rect x="3" y="6" width="3.5" height="1.5" rx="0.6" {...common} />
          <path d="M1.5 6.8V11M14.5 6.8V11M1.5 5.5h13" {...common} />
        </svg>
      );
    case 'Food & Dining':
      return (
        <svg viewBox="0 0 16 16" fill="none" aria-hidden style={style}>
          <path d="M4.5 2.5v4.2M3.3 2.5v2.4M5.7 2.5v2.4M4.5 6.7v6.8M11.8 2.5l-3.5 4.1M8.3 6.6l3.5 6.9" {...common} />
        </svg>
      );
    case 'Activities':
      return (
        <svg viewBox="0 0 16 16" fill="none" aria-hidden style={style}>
          <path d="m8 2.2 1.7 3.5 3.9.6-2.8 2.8.7 3.9L8 11.1 4.5 13l.7-3.9L2.4 6.3l3.9-.6L8 2.2Z" {...common} />
        </svg>
      );
    case 'Transport':
      return (
        <svg viewBox="0 0 16 16" fill="none" aria-hidden style={style}>
          <rect x="3" y="2.8" width="10" height="8.2" rx="1.2" {...common} />
          <path d="M5.2 5.1h2.2M8.6 5.1h2.2M3.2 8.5h9.6M5 13.2l1.2-1.8M11 13.2l-1.2-1.8" {...common} />
        </svg>
      );
    default:
      return (
        <svg viewBox="0 0 16 16" fill="none" aria-hidden style={style}>
          <path d="M3 4.2h10M3 8h10M3 11.8h10" {...common} />
        </svg>
      );
  }
};
