import * as React from 'react';
import type { LocationHighlightKind } from '../../utils/locationInfoEntry';

const TONE: Record<LocationHighlightKind, { bg: string; fg: string; border: string }> = {
  sight: { bg: '#e8eef5', fg: '#3d5a80', border: '#c8d6e4' },
  food: { bg: '#f8eee4', fg: '#c4783a', border: '#e8d4c0' },
  drink: { bg: '#f4ebe8', fg: '#8a5a4a', border: '#e4cfc8' },
  souvenir: { bg: '#f8ebe6', fg: '#c45c3a', border: '#ecd4cc' }
};

function IconGlyph({ kind }: { kind: LocationHighlightKind }): React.ReactElement {
  if (kind === 'sight') {
    return (
      <svg width="100%" height="100%" viewBox="0 0 24 24" fill="none" aria-hidden>
        <path d="M4 10V8l8-4 8 4v2M6 10v8h12v-8" stroke="currentColor" strokeWidth="1.7" strokeLinejoin="round" />
        <path d="M10 14h4" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" />
      </svg>
    );
  }
  if (kind === 'food') {
    return (
      <svg width="100%" height="100%" viewBox="0 0 24 24" fill="none" aria-hidden>
        <path d="M7 3v8M7 11v10M5 3c0 2.5 2 4 2 8M9 3c0 2.5-2 4-2 8M14 3v18M17 3v7a3 3 0 0 1-3 3" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" />
      </svg>
    );
  }
  if (kind === 'drink') {
    return (
      <svg width="100%" height="100%" viewBox="0 0 24 24" fill="none" aria-hidden>
        <path d="M8 3h8l-2 9H10L8 3ZM10 12v5M8 20h8" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    );
  }
  return (
    <svg width="100%" height="100%" viewBox="0 0 24 24" fill="none" aria-hidden>
      <rect x="5" y="8" width="14" height="11" rx="2" stroke="currentColor" strokeWidth="1.7" />
      <path d="M9 8V6h6v2M12 12v4" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" />
    </svg>
  );
}

export interface LocationHighlightIconProps {
  kind: LocationHighlightKind;
  size?: 'sm' | 'md';
}

export const LocationHighlightIcon: React.FC<LocationHighlightIconProps> = ({ kind, size = 'md' }) => {
  const tone = TONE[kind];
  const px = size === 'sm' ? 28 : 36;
  const glyph = size === 'sm' ? 14 : 18;
  return (
    <span
      style={{
        width: px,
        height: px,
        borderRadius: 999,
        background: tone.bg,
        color: tone.fg,
        border: `1.5px solid ${tone.border}`,
        boxShadow: `0 3px 10px color-mix(in srgb, ${tone.fg} 14%, transparent)`,
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        flexShrink: 0
      }}
      aria-hidden
    >
      <span style={{ width: glyph, height: glyph, display: 'inline-flex' }}>
        <IconGlyph kind={kind} />
      </span>
    </span>
  );
};
