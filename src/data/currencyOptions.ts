/** Pinned first (market order); remainder alphabetical by code. Single source for all currency selects. */
export const PINNED_CURRENCIES: { code: string; name: string }[] = [
  { code: 'NZD', name: 'New Zealand Dollar' },
  { code: 'AUD', name: 'Australian Dollar' },
  { code: 'USD', name: 'United States Dollar' },
  { code: 'EUR', name: 'Euro' },
  { code: 'GBP', name: 'British Pound' },
  { code: 'JPY', name: 'Japanese Yen' },
  { code: 'SGD', name: 'Singapore Dollar' },
  { code: 'THB', name: 'Thai Baht' },
  { code: 'CAD', name: 'Canadian Dollar' },
  { code: 'HKD', name: 'Hong Kong Dollar' }
];

const OTHER_CODES = [
  'CNY',
  'IDR',
  'MYR',
  'PHP',
  'KRW',
  'INR',
  'AED',
  'SAR',
  'ZAR',
  'CHF',
  'SEK',
  'NOK',
  'DKK',
  'MXN',
  'BRL',
  'CZK',
  'HUF',
  'PLN',
  'RON',
  'TRY',
  'ILS',
  'EGP',
  'VND',
  'TWD',
  'PKR',
  'BDT',
  'CLP',
  'COP',
  'PEN',
  'UAH',
  'NGN',
  'KES',
  'GHS',
  'MAD',
  'XOF',
  'XAF',
  'FJD',
  'PGK',
  'WST',
  'TOP',
  'SBD',
  'VUV'
] as const;

const OTHER_NAMES: Partial<Record<string, string>> = {
  CNY: 'Chinese Yuan',
  IDR: 'Indonesian Rupiah',
  MYR: 'Malaysian Ringgit',
  PHP: 'Philippine Peso',
  KRW: 'South Korean Won',
  INR: 'Indian Rupee',
  AED: 'UAE Dirham',
  SAR: 'Saudi Riyal',
  ZAR: 'South African Rand',
  CHF: 'Swiss Franc',
  SEK: 'Swedish Krona',
  NOK: 'Norwegian Krone',
  DKK: 'Danish Krone',
  MXN: 'Mexican Peso',
  BRL: 'Brazilian Real',
  CZK: 'Czech Koruna',
  HUF: 'Hungarian Forint',
  PLN: 'Polish Zloty',
  RON: 'Romanian Leu',
  TRY: 'Turkish Lira',
  ILS: 'Israeli Shekel',
  EGP: 'Egyptian Pound',
  VND: 'Vietnamese Dong',
  TWD: 'Taiwan Dollar',
  PKR: 'Pakistani Rupee',
  BDT: 'Bangladeshi Taka',
  CLP: 'Chilean Peso',
  COP: 'Colombian Peso',
  PEN: 'Peruvian Sol',
  UAH: 'Ukrainian Hryvnia',
  NGN: 'Nigerian Naira',
  KES: 'Kenyan Shilling',
  GHS: 'Ghanaian Cedi',
  MAD: 'Moroccan Dirham',
  XOF: 'West African CFA Franc',
  XAF: 'Central African CFA Franc',
  FJD: 'Fiji Dollar',
  PGK: 'Papua New Guinean Kina',
  WST: 'Samoan Tala',
  TOP: 'Tongan Paʻanga',
  SBD: 'Solomon Islands Dollar',
  VUV: 'Vanuatu Vatu'
};

const pinnedSet = new Set(PINNED_CURRENCIES.map((c) => c.code));

export const OTHER_CURRENCIES: { code: string; name: string }[] = [...OTHER_CODES]
  .filter((code) => !pinnedSet.has(code))
  .sort((a, b) => a.localeCompare(b))
  .map((code) => ({ code, name: OTHER_NAMES[code] ?? code }));

/** All supported codes in select order (pinned then A–Z). */
export const ALL_CURRENCY_CODES: string[] = [...PINNED_CURRENCIES.map((c) => c.code), ...OTHER_CURRENCIES.map((c) => c.code)];

export const KNOWN_CURRENCY_CODE_SET = new Set(ALL_CURRENCY_CODES);
