export interface TypicalPriceItem {
  item: string;
  /** Amount in local currency */
  amount: number;
}

export interface CountryData {
  currency: string;
  currencyCode: string;
  /** Short one-line tipping summary (legacy / fallback) */
  tipping: string;
  /** Bullet tips for the Weather & Tips tip-advice block */
  tippingBullets?: string[];
  /** e.g. "GST: 9%" or "VAT: 20%" */
  taxLabel?: string;
  /** When true, show “Included in displayed prices” */
  taxIncluded?: boolean;
  typicalPrices?: TypicalPriceItem[];
  region:
    | 'Western Europe'
    | 'Southern Europe'
    | 'Southeast Asia'
    | 'East Asia'
    | 'North America'
    | 'Australia/NZ'
    | 'Middle East'
    | 'Caribbean';
}

function prices(
  rows: Array<[string, number]>
): TypicalPriceItem[] {
  return rows.map(([item, amount]) => ({ item, amount }));
}

export const COUNTRY_DATA: Record<string, CountryData> = {
  NZ: {
    currency: 'New Zealand Dollar',
    currencyCode: 'NZD',
    tipping: 'Not expected; optional for great service',
    tippingBullets: [
      'Tipping is not expected in New Zealand.',
      'Rounding up a café bill is a nice gesture.',
      'Service charges are uncommon in everyday venues.'
    ],
    taxLabel: 'GST: 15%',
    taxIncluded: true,
    typicalPrices: prices([
      ['Coffee (café)', 5.5],
      ['Café lunch', 18],
      ['Restaurant dinner (mid-range)', 45],
      ['Beer (local)', 10],
      ['Taxi (5 km)', 18],
      ['Bus / train single', 3.5]
    ]),
    region: 'Australia/NZ'
  },
  AU: {
    currency: 'Australian Dollar',
    currencyCode: 'AUD',
    tipping: 'Not expected; 10% for excellent service',
    tippingBullets: [
      'Tipping is not expected day-to-day.',
      '10% is appreciated for excellent restaurant service.',
      'Rounding up taxis or café bills is common.'
    ],
    taxLabel: 'GST: 10%',
    taxIncluded: true,
    typicalPrices: prices([
      ['Coffee (café)', 5],
      ['Café lunch', 18],
      ['Restaurant dinner (mid-range)', 45],
      ['Beer (local)', 9],
      ['Taxi (5 km)', 20],
      ['Transit single', 4]
    ]),
    region: 'Australia/NZ'
  },
  SG: {
    currency: 'Singapore Dollar',
    currencyCode: 'SGD',
    tipping: 'Not expected; service charge often included',
    tippingBullets: [
      'Tipping is not expected in Singapore.',
      'Many restaurants already add a service charge.',
      'Rounding up the bill is a polite optional gesture.'
    ],
    taxLabel: 'GST: 9%',
    taxIncluded: true,
    typicalPrices: prices([
      ['Coffee (café)', 5.5],
      ['Hawker meal', 6],
      ['Restaurant dinner (mid-range)', 45],
      ['Beer (local)', 12],
      ['Taxi (5 km)', 12],
      ['MRT single trip', 1.5]
    ]),
    region: 'Southeast Asia'
  },
  TH: {
    currency: 'Thai Baht',
    currencyCode: 'THB',
    tipping: 'Round up; small tips appreciated',
    tippingBullets: [
      'Small tips and rounding up are appreciated.',
      '10% is fine in tourist restaurants if service is not included.',
      'Street food and markets usually do not expect tips.'
    ],
    taxLabel: 'VAT: 7%',
    taxIncluded: true,
    typicalPrices: prices([
      ['Coffee (café)', 120],
      ['Street / casual meal', 80],
      ['Restaurant dinner (mid-range)', 450],
      ['Beer (local)', 100],
      ['Taxi (5 km)', 80],
      ['BTS / MRT single', 45]
    ]),
    region: 'Southeast Asia'
  },
  ID: {
    currency: 'Indonesian Rupiah',
    currencyCode: 'IDR',
    tipping: 'Round up or 5-10% where service not included',
    tippingBullets: [
      'Round up or leave 5–10% where service is not included.',
      'Service charges appear on many restaurant bills.',
      'Small change tips are common for drivers and hotel staff.'
    ],
    taxLabel: 'VAT: 11%',
    taxIncluded: true,
    typicalPrices: prices([
      ['Coffee (café)', 45000],
      ['Casual meal', 50000],
      ['Restaurant dinner (mid-range)', 250000],
      ['Beer (local)', 45000],
      ['Taxi (5 km)', 60000],
      ['Transit single', 5000]
    ]),
    region: 'Southeast Asia'
  },
  MY: {
    currency: 'Malaysian Ringgit',
    currencyCode: 'MYR',
    tipping: 'Not expected; round up common',
    tippingBullets: [
      'Tipping is not expected; rounding up is common.',
      'Service charges may already be included.',
      'A small tip for great service is appreciated.'
    ],
    taxLabel: 'SST: 6–8%',
    taxIncluded: true,
    typicalPrices: prices([
      ['Coffee (café)', 12],
      ['Hawker / casual meal', 15],
      ['Restaurant dinner (mid-range)', 80],
      ['Beer (local)', 18],
      ['Grab / taxi (5 km)', 15],
      ['LRT / MRT single', 3]
    ]),
    region: 'Southeast Asia'
  },
  JP: {
    currency: 'Japanese Yen',
    currencyCode: 'JPY',
    tipping: 'Not expected',
    tippingBullets: [
      'Tipping is not expected in Japan.',
      'Leaving cash tip can confuse staff — excellent service is the norm.',
      'Service charges may appear at high-end venues only.'
    ],
    taxLabel: 'Consumption tax: 10%',
    taxIncluded: true,
    typicalPrices: prices([
      ['Coffee (café)', 450],
      ['Casual meal', 1200],
      ['Restaurant dinner (mid-range)', 4000],
      ['Beer (local)', 600],
      ['Taxi (5 km)', 2000],
      ['Metro single', 200]
    ]),
    region: 'East Asia'
  },
  KR: {
    currency: 'South Korean Won',
    currencyCode: 'KRW',
    tipping: 'Not expected; sometimes in tourist venues',
    tippingBullets: [
      'Tipping is not expected in Korea.',
      'Tourist restaurants may accept a small tip.',
      'Service is usually included in the bill.'
    ],
    taxLabel: 'VAT: 10%',
    taxIncluded: true,
    typicalPrices: prices([
      ['Coffee (café)', 5000],
      ['Casual meal', 10000],
      ['Restaurant dinner (mid-range)', 35000],
      ['Beer (local)', 5000],
      ['Taxi (5 km)', 8000],
      ['Metro single', 1500]
    ]),
    region: 'East Asia'
  },
  CN: {
    currency: 'Chinese Yuan',
    currencyCode: 'CNY',
    tipping: 'Generally not expected',
    tippingBullets: [
      'Tipping is generally not expected.',
      'High-end hotels and international venues may add service charges.',
      'Rounding up is occasionally done by tourists.'
    ],
    taxLabel: 'VAT varies',
    taxIncluded: true,
    typicalPrices: prices([
      ['Coffee (café)', 35],
      ['Casual meal', 40],
      ['Restaurant dinner (mid-range)', 150],
      ['Beer (local)', 20],
      ['Taxi (5 km)', 25],
      ['Metro single', 4]
    ]),
    region: 'East Asia'
  },
  HK: {
    currency: 'Hong Kong Dollar',
    currencyCode: 'HKD',
    tipping: '10% common in restaurants',
    tippingBullets: [
      'Around 10% is common in restaurants if not included.',
      'Service charges are often printed on the bill.',
      'Rounding up taxis is appreciated.'
    ],
    taxLabel: 'No GST/VAT',
    taxIncluded: true,
    typicalPrices: prices([
      ['Coffee (café)', 40],
      ['Casual meal', 80],
      ['Restaurant dinner (mid-range)', 280],
      ['Beer (local)', 55],
      ['Taxi (5 km)', 50],
      ['MTR single', 12]
    ]),
    region: 'East Asia'
  },
  GB: {
    currency: 'Pound Sterling',
    currencyCode: 'GBP',
    tipping: '10-12.5% in restaurants if not included',
    tippingBullets: [
      '10–12.5% in restaurants if service is not included.',
      'Check the bill — many places add a discretionary service charge.',
      'Rounding up for taxis and cafés is common.'
    ],
    taxLabel: 'VAT: 20%',
    taxIncluded: true,
    typicalPrices: prices([
      ['Coffee (café)', 3.5],
      ['Café lunch', 12],
      ['Restaurant dinner (mid-range)', 35],
      ['Beer (local)', 5.5],
      ['Taxi (5 km)', 15],
      ['Tube / bus single', 2.8]
    ]),
    region: 'Western Europe'
  },
  FR: {
    currency: 'Euro',
    currencyCode: 'EUR',
    tipping: 'Service included; small round-up common',
    tippingBullets: [
      'Service is usually included (service compris).',
      'Leaving small change or rounding up is appreciated.',
      'A few euros for outstanding restaurant service is fine.'
    ],
    taxLabel: 'VAT: 20%',
    taxIncluded: true,
    typicalPrices: prices([
      ['Coffee (café)', 3],
      ['Café lunch', 15],
      ['Restaurant dinner (mid-range)', 40],
      ['Beer (local)', 6],
      ['Taxi (5 km)', 18],
      ['Metro single', 2.15]
    ]),
    region: 'Western Europe'
  },
  DE: {
    currency: 'Euro',
    currencyCode: 'EUR',
    tipping: '5-10% or round up',
    tippingBullets: [
      '5–10% or rounding up is customary in restaurants.',
      'Tell the server the total you want to pay when settling.',
      'Service charges are less common than in some countries.'
    ],
    taxLabel: 'VAT: 19%',
    taxIncluded: true,
    typicalPrices: prices([
      ['Coffee (café)', 3.5],
      ['Café lunch', 12],
      ['Restaurant dinner (mid-range)', 35],
      ['Beer (local)', 4],
      ['Taxi (5 km)', 16],
      ['U-Bahn single', 3.5]
    ]),
    region: 'Western Europe'
  },
  ES: {
    currency: 'Euro',
    currencyCode: 'EUR',
    tipping: 'Small tips or round up',
    tippingBullets: [
      'Small tips or rounding up are common.',
      '5–10% for sit-down meals if service was good.',
      'Bars and cafés often just get spare change.'
    ],
    taxLabel: 'VAT: 21%',
    taxIncluded: true,
    typicalPrices: prices([
      ['Coffee (café)', 2],
      ['Casual meal / tapas', 15],
      ['Restaurant dinner (mid-range)', 35],
      ['Beer (local)', 3],
      ['Taxi (5 km)', 12],
      ['Metro single', 1.5]
    ]),
    region: 'Southern Europe'
  },
  IT: {
    currency: 'Euro',
    currencyCode: 'EUR',
    tipping: 'Small tip/round up; coperto may apply',
    tippingBullets: [
      'A small tip or round-up is appreciated.',
      'Watch for coperto (cover charge) already on the bill.',
      'Service charges may also appear separately.'
    ],
    taxLabel: 'VAT: 22%',
    taxIncluded: true,
    typicalPrices: prices([
      ['Coffee (espresso bar)', 1.5],
      ['Casual meal', 18],
      ['Restaurant dinner (mid-range)', 40],
      ['Beer (local)', 5],
      ['Taxi (5 km)', 15],
      ['Metro / tram single', 1.5]
    ]),
    region: 'Southern Europe'
  },
  US: {
    currency: 'US Dollar',
    currencyCode: 'USD',
    tipping: '15-20% standard in restaurants',
    tippingBullets: [
      '15–20% is standard in restaurants.',
      'Tip jars and card prompts are common for cafés.',
      'Taxi and rideshare apps usually suggest a tip.'
    ],
    taxLabel: 'Sales tax: varies by state',
    taxIncluded: false,
    typicalPrices: prices([
      ['Coffee (café)', 5],
      ['Casual meal', 18],
      ['Restaurant dinner (mid-range)', 45],
      ['Beer (local)', 7],
      ['Taxi (5 km)', 18],
      ['Transit single', 2.9]
    ]),
    region: 'North America'
  },
  CA: {
    currency: 'Canadian Dollar',
    currencyCode: 'CAD',
    tipping: '15-20% standard in restaurants',
    tippingBullets: [
      '15–20% is standard in restaurants.',
      'Sales tax is usually added at the till (not included).',
      'Rounding up for cafés and taxis is common.'
    ],
    taxLabel: 'GST/HST: varies by province',
    taxIncluded: false,
    typicalPrices: prices([
      ['Coffee (café)', 5],
      ['Casual meal', 18],
      ['Restaurant dinner (mid-range)', 45],
      ['Beer (local)', 8],
      ['Taxi (5 km)', 18],
      ['Transit single', 3.5]
    ]),
    region: 'North America'
  },
  MX: {
    currency: 'Mexican Peso',
    currencyCode: 'MXN',
    tipping: '10-15% standard',
    tippingBullets: [
      '10–15% is standard in restaurants.',
      'Small tips for hotel and tour staff are appreciated.',
      'Check whether a service charge is already included.'
    ],
    taxLabel: 'IVA: 16%',
    taxIncluded: true,
    typicalPrices: prices([
      ['Coffee (café)', 60],
      ['Casual meal', 150],
      ['Restaurant dinner (mid-range)', 450],
      ['Beer (local)', 50],
      ['Taxi (5 km)', 80],
      ['Metro single', 5]
    ]),
    region: 'North America'
  },
  AE: {
    currency: 'UAE Dirham',
    currencyCode: 'AED',
    tipping: '10-15% if not included',
    tippingBullets: [
      '10–15% if service is not already included.',
      'Many hotels and restaurants add a service charge.',
      'Rounding up for taxis is common.'
    ],
    taxLabel: 'VAT: 5%',
    taxIncluded: true,
    typicalPrices: prices([
      ['Coffee (café)', 22],
      ['Casual meal', 45],
      ['Restaurant dinner (mid-range)', 150],
      ['Beer (local)', 35],
      ['Taxi (5 km)', 25],
      ['Metro single', 5]
    ]),
    region: 'Middle East'
  },
  SA: {
    currency: 'Saudi Riyal',
    currencyCode: 'SAR',
    tipping: '10-15% if not included',
    tippingBullets: [
      '10–15% if service is not included.',
      'Service charges appear on many restaurant bills.',
      'Small tips for hotel staff are appreciated.'
    ],
    taxLabel: 'VAT: 15%',
    taxIncluded: true,
    typicalPrices: prices([
      ['Coffee (café)', 20],
      ['Casual meal', 40],
      ['Restaurant dinner (mid-range)', 140],
      ['Soft drink', 8],
      ['Taxi (5 km)', 25],
      ['Metro / transit', 4]
    ]),
    region: 'Middle East'
  },
  QA: {
    currency: 'Qatari Riyal',
    currencyCode: 'QAR',
    tipping: '10% where service not included',
    tippingBullets: [
      'Around 10% where service is not included.',
      'Hotel restaurants often add a service charge.',
      'Rounding up taxis is appreciated.'
    ],
    taxLabel: 'VAT: 0% (no VAT currently)',
    taxIncluded: true,
    typicalPrices: prices([
      ['Coffee (café)', 18],
      ['Casual meal', 45],
      ['Restaurant dinner (mid-range)', 160],
      ['Soft drink', 8],
      ['Taxi (5 km)', 25],
      ['Metro single', 3]
    ]),
    region: 'Middle East'
  },
  JM: {
    currency: 'Jamaican Dollar',
    currencyCode: 'JMD',
    tipping: '10-15% standard',
    tippingBullets: [
      '10–15% is standard in restaurants.',
      'All-inclusives may already cover tips — check your package.',
      'Small tips for drivers and guides are appreciated.'
    ],
    taxLabel: 'GCT: 15%',
    taxIncluded: true,
    typicalPrices: prices([
      ['Coffee (café)', 450],
      ['Casual meal', 1200],
      ['Restaurant dinner (mid-range)', 3500],
      ['Beer (local)', 400],
      ['Taxi (5 km)', 800],
      ['Local bus', 100]
    ]),
    region: 'Caribbean'
  },
  BB: {
    currency: 'Barbadian Dollar',
    currencyCode: 'BBD',
    tipping: '10-15% standard',
    tippingBullets: [
      '10–15% is standard in restaurants.',
      'Service charges may already be included.',
      'Rounding up for taxis is common.'
    ],
    taxLabel: 'VAT: 17.5%',
    taxIncluded: true,
    typicalPrices: prices([
      ['Coffee (café)', 8],
      ['Casual meal', 30],
      ['Restaurant dinner (mid-range)', 90],
      ['Beer (local)', 6],
      ['Taxi (5 km)', 25],
      ['Bus single', 3.5]
    ]),
    region: 'Caribbean'
  },
  BS: {
    currency: 'Bahamian Dollar',
    currencyCode: 'BSD',
    tipping: '15% common',
    tippingBullets: [
      'Around 15% is common in restaurants.',
      'Resort packages may include gratuities.',
      'Taxi tips of about 15% are typical.'
    ],
    taxLabel: 'VAT: 10%',
    taxIncluded: true,
    typicalPrices: prices([
      ['Coffee (café)', 5],
      ['Casual meal', 18],
      ['Restaurant dinner (mid-range)', 55],
      ['Beer (local)', 6],
      ['Taxi (5 km)', 20],
      ['Bus / jitney', 1.25]
    ]),
    region: 'Caribbean'
  }
};
