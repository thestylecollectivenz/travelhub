import * as React from 'react';

export interface CategoryIconProps {
  category: string;
  size?: number;
  color?: string;
}

export const CategoryIcon: React.FC<CategoryIconProps> = ({ category, size = 16, color = 'var(--color-sand-400)' }) => {
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
          {/* Bed base */}
          <path d="M1.5 11.5v-4a1 1 0 0 1 1-1h11a1 1 0 0 1 1 1v4" {...common} />
          {/* Headboard */}
          <path d="M3 6.5V4.5a1 1 0 0 1 1-1h8a1 1 0 0 1 1 1v2" {...common} />
          {/* Pillow */}
          <rect x="4.5" y="5" width="3" height="1.5" rx="0.5" {...common} />
          {/* Floor line */}
          <path d="M1 11.5h14" {...common} />
          {/* Legs */}
          <path d="M3 11.5v1.5M13 11.5v1.5" {...common} />
        </svg>
      );
    case 'Cruise':
    case 'Cruise port':
    case 'Cruise at sea':
      return (
        <svg viewBox="0 0 16 16" fill="none" aria-hidden style={style}>
          <path d="M2 10.8h12l-1.1 2H3.1l-1.1-2Z" {...common} />
          <path d="M5.2 10.8V6.3h5.6v4.5M7.2 6.3V4.5h1.6v1.8M10.8 6.3h1.3" {...common} />
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
    case 'Travel Overheads':
      return (
        <svg viewBox="0 0 16 16" fill="none" aria-hidden style={style}>
          <circle cx="8" cy="8" r="5.5" {...common} />
          <path d="M8 4.5v7" {...common} />
          <path d="M10 6a2 2 0 0 0-2-1.5A1.5 1.5 0 0 0 8 7.5c1.1 0 2 .7 2 1.5A2 2 0 0 1 8 10.5 2 2 0 0 1 6 9" {...common} />
        </svg>
      );
    case 'Preparation':
      return (
        <svg viewBox="0 0 16 16" fill="none" aria-hidden style={style}>
          <path d="M5.5 8.5 7.2 10.5 10.5 6" {...common} />
          <rect x="2.5" y="2.5" width="11" height="11" rx="1.5" {...common} />
          <path d="M5.5 2.5v2M10.5 2.5v2" {...common} />
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
