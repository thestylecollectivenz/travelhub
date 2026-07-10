import * as React from 'react';
import type { NearYouToolId } from '../../utils/nearYouTools';

export type NearYouIconSize = 'sm' | 'md' | 'lg';

const TONE: Record<
  NearYouToolId,
  { bg: string; fg: string; border: string }
> = {
  dining: { bg: '#f8eee4', fg: '#c4783a', border: '#e8d4c0' },
  restroom: { bg: '#eef1f4', fg: '#5c6b7a', border: '#d8dee6' },
  atm: { bg: '#eef4e8', fg: '#6b7c3a', border: '#d4dfc4' },
  grocery: { bg: '#f8ebe6', fg: '#c45c3a', border: '#ecd4cc' },
  transport: { bg: '#eceeef', fg: '#5c6570', border: '#d6d8dc' },
  medical: { bg: '#eef1e4', fg: '#6b7c3a', border: '#d4dfc4' },
  pharmacy: { bg: '#e8f0f4', fg: '#4a7a8c', border: '#c8dde6' },
  fuel: { bg: '#f4f0e8', fg: '#8a7355', border: '#e0d6c8' }
};

function IconGlyph({ id }: { id: NearYouToolId }): React.ReactElement {
  switch (id) {
    case 'dining':
      return (
        <svg width="100%" height="100%" viewBox="0 0 24 24" fill="none" aria-hidden>
          <path d="M7 3v8M7 11v10M5 3c0 2.5 2 4 2 8M9 3c0 2.5-2 4-2 8M14 3v18M17 3v7a3 3 0 0 1-3 3" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" />
        </svg>
      );
    case 'restroom':
      return (
        <svg width="100%" height="100%" viewBox="0 0 24 24" fill="none" aria-hidden>
          <circle cx="8" cy="6" r="2" stroke="currentColor" strokeWidth="1.6" />
          <path d="M5.5 20v-7.5A2.5 2.5 0 0 1 8 10h0a2.5 2.5 0 0 1 2.5 2.5V20" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
          <circle cx="16" cy="6" r="2" stroke="currentColor" strokeWidth="1.6" />
          <path d="M13.5 20v-6h5v6M13.5 14h5" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
        </svg>
      );
    case 'atm':
      return (
        <svg width="100%" height="100%" viewBox="0 0 24 24" fill="none" aria-hidden>
          <circle cx="12" cy="12" r="8" stroke="currentColor" strokeWidth="1.7" />
          <path d="M12 7.5v9M9.5 9.5c.6-1 1.5-1.5 2.5-1.5 1.4 0 2.5.8 2.5 2s-1.1 2-2.5 2c-1.4 0-2.5.8-2.5 2s1.1 2 2.5 2c1 0 1.9-.5 2.5-1.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
        </svg>
      );
    case 'grocery':
      return (
        <svg width="100%" height="100%" viewBox="0 0 24 24" fill="none" aria-hidden>
          <path d="M6 7h15l-1.5 9H7.5L6 7Z" stroke="currentColor" strokeWidth="1.6" strokeLinejoin="round" />
          <path d="M6 7 5 3H2" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
          <circle cx="9" cy="19" r="1.5" fill="currentColor" />
          <circle cx="17" cy="19" r="1.5" fill="currentColor" />
        </svg>
      );
    case 'transport':
      return (
        <svg width="100%" height="100%" viewBox="0 0 24 24" fill="none" aria-hidden>
          <rect x="5" y="4" width="14" height="12" rx="2" stroke="currentColor" strokeWidth="1.7" />
          <path d="M5 12h14M8 19h.01M16 19h.01" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" />
        </svg>
      );
    case 'medical':
      return (
        <svg width="100%" height="100%" viewBox="0 0 24 24" fill="none" aria-hidden>
          <path d="M8 4h8v4h4v8h-4v4H8v-4H4V8h4V4Z" stroke="currentColor" strokeWidth="1.7" strokeLinejoin="round" />
        </svg>
      );
    case 'pharmacy':
      return (
        <svg width="100%" height="100%" viewBox="0 0 24 24" fill="none" aria-hidden>
          <rect x="4" y="8" width="16" height="12" rx="2" stroke="currentColor" strokeWidth="1.6" />
          <path d="M12 8V4M9 4h6M12 12v6M9 15h6" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
        </svg>
      );
    case 'fuel':
      return (
        <svg width="100%" height="100%" viewBox="0 0 24 24" fill="none" aria-hidden>
          <path d="M6 20V6a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v14" stroke="currentColor" strokeWidth="1.6" />
          <path d="M14 10h2l2 3v7h-4" stroke="currentColor" strokeWidth="1.6" strokeLinejoin="round" />
          <path d="M8 10h4" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
        </svg>
      );
    default:
      return <span>?</span>;
  }
}

const SIZE_PX: Record<NearYouIconSize, number> = { sm: 28, md: 38, lg: 48 };
const GLYPH_PX: Record<NearYouIconSize, number> = { sm: 14, md: 18, lg: 22 };

export interface NearYouToolIconProps {
  toolId: NearYouToolId;
  size?: NearYouIconSize;
  className?: string;
  label?: string;
}

export const NearYouToolIcon: React.FC<NearYouToolIconProps> = ({
  toolId,
  size = 'md',
  className,
  label
}) => {
  const tone = TONE[toolId] ?? TONE.dining;
  const px = SIZE_PX[size];
  const glyph = GLYPH_PX[size];
  return (
    <span
      className={className}
      style={{
        width: px,
        height: px,
        borderRadius: 999,
        background: tone.bg,
        color: tone.fg,
        border: `1.5px solid ${tone.border}`,
        boxShadow: `0 3px 10px color-mix(in srgb, ${tone.fg} 16%, transparent)`,
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        flexShrink: 0
      }}
      aria-hidden={label ? undefined : true}
      aria-label={label}
    >
      <span style={{ width: glyph, height: glyph, display: 'inline-flex' }}>
        <IconGlyph id={toolId} />
      </span>
    </span>
  );
};
