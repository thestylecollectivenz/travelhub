import * as React from 'react';

/** Small inline icons for packing list categories (no external icon library). */
export function PackingCategoryIcon({ category, size = 18 }: { category: string; size?: number }): React.ReactElement {
  const c = (category || '').trim().toLowerCase();
  const stroke = 'currentColor';
  const sw = 1.6;
  const common = { width: size, height: size, viewBox: '0 0 24 24', fill: 'none' as const, 'aria-hidden': true };

  if (/accessor|umbrella|glove|hat|sunglass|jewel/.test(c)) {
    return (
      <svg {...common}>
        <path d="M12 4v3M8 9a4 4 0 0 0 8 0" stroke={stroke} strokeWidth={sw} strokeLinecap="round" />
        <path d="M7 20c1.5-4 8.5-4 10 0" stroke={stroke} strokeWidth={sw} strokeLinecap="round" />
        <circle cx="12" cy="12" r="2" stroke={stroke} strokeWidth={sw} />
      </svg>
    );
  }
  if (/cloth|dress|shirt|trouser|jacket|coat|sock|underwear/.test(c)) {
    return (
      <svg {...common}>
        <path
          d="M9 4h6l2 3 3 1v3l-3-1v9H7v-9l-3 1V8l3-1 2-3Z"
          stroke={stroke}
          strokeWidth={sw}
          strokeLinejoin="round"
        />
      </svg>
    );
  }
  if (/shoe|footwear|boot|sandal/.test(c)) {
    return (
      <svg {...common}>
        <path
          d="M4 15c2-1 4-2 7-2h6l3 3v2H4v-3Z"
          stroke={stroke}
          strokeWidth={sw}
          strokeLinejoin="round"
        />
      </svg>
    );
  }
  if (/electr|cable|charger|adapter|plug|tech|device/.test(c)) {
    return (
      <svg {...common}>
        <path d="M9 3v6M15 3v6M8 9h8v4l-2 7h-4l-2-7V9Z" stroke={stroke} strokeWidth={sw} strokeLinejoin="round" />
      </svg>
    );
  }
  if (/toiletr|cosmetic|hygiene|soap|tooth/.test(c)) {
    return (
      <svg {...common}>
        <rect x="9" y="3" width="6" height="10" rx="1.5" stroke={stroke} strokeWidth={sw} />
        <path d="M9 13h6v7H9v-7Z" stroke={stroke} strokeWidth={sw} strokeLinejoin="round" />
      </svg>
    );
  }
  if (/bag|luggage|suitcase|backpack/.test(c)) {
    return (
      <svg {...common}>
        <rect x="5" y="8" width="14" height="12" rx="2" stroke={stroke} strokeWidth={sw} />
        <path d="M9 8V6a3 3 0 0 1 6 0v2" stroke={stroke} strokeWidth={sw} />
      </svg>
    );
  }
  if (/document|paper|ticket|passport|visa/.test(c)) {
    return (
      <svg {...common}>
        <path d="M7 3h7l4 4v14H7V3Z" stroke={stroke} strokeWidth={sw} strokeLinejoin="round" />
        <path d="M14 3v4h4M9 12h6M9 16h4" stroke={stroke} strokeWidth={sw} strokeLinecap="round" />
      </svg>
    );
  }
  if (/medic|first|health|pill/.test(c)) {
    return (
      <svg {...common}>
        <path d="M9 3h6v6h6v6h-6v6H9v-6H3V9h6V3Z" stroke={stroke} strokeWidth={sw} strokeLinejoin="round" />
      </svg>
    );
  }
  if (/food|snack|drink/.test(c)) {
    return (
      <svg {...common}>
        <path d="M6 10c0-3 2.5-5 6-5s6 2 6 5v9H6v-9Z" stroke={stroke} strokeWidth={sw} strokeLinejoin="round" />
        <path d="M9 10v9M15 10v9" stroke={stroke} strokeWidth={sw} strokeLinecap="round" />
      </svg>
    );
  }
  // Default / Other
  return (
    <svg {...common}>
      <rect x="5" y="6" width="14" height="12" rx="2" stroke={stroke} strokeWidth={sw} />
      <path d="M9 6V5h6v1" stroke={stroke} strokeWidth={sw} strokeLinecap="round" />
    </svg>
  );
}
