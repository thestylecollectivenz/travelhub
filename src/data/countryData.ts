export interface CountryData {
  currency: string;
  currencyCode: string;
  tipping: string;
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

export const COUNTRY_DATA: Record<string, CountryData> = {
  NZ: { currency: 'New Zealand Dollar', currencyCode: 'NZD', tipping: 'Not expected; optional for great service', region: 'Australia/NZ' },
  AU: { currency: 'Australian Dollar', currencyCode: 'AUD', tipping: 'Not expected; 10% for excellent service', region: 'Australia/NZ' },
  SG: { currency: 'Singapore Dollar', currencyCode: 'SGD', tipping: 'Not expected; service charge often included', region: 'Southeast Asia' },
  TH: { currency: 'Thai Baht', currencyCode: 'THB', tipping: 'Round up; small tips appreciated', region: 'Southeast Asia' },
  ID: { currency: 'Indonesian Rupiah', currencyCode: 'IDR', tipping: 'Round up or 5-10% where service not included', region: 'Southeast Asia' },
  MY: { currency: 'Malaysian Ringgit', currencyCode: 'MYR', tipping: 'Not expected; round up common', region: 'Southeast Asia' },
  JP: { currency: 'Japanese Yen', currencyCode: 'JPY', tipping: 'Not expected', region: 'East Asia' },
  KR: { currency: 'South Korean Won', currencyCode: 'KRW', tipping: 'Not expected; sometimes in tourist venues', region: 'East Asia' },
  CN: { currency: 'Chinese Yuan', currencyCode: 'CNY', tipping: 'Generally not expected', region: 'East Asia' },
  HK: { currency: 'Hong Kong Dollar', currencyCode: 'HKD', tipping: '10% common in restaurants', region: 'East Asia' },
  GB: { currency: 'Pound Sterling', currencyCode: 'GBP', tipping: '10-12.5% in restaurants if not included', region: 'Western Europe' },
  FR: { currency: 'Euro', currencyCode: 'EUR', tipping: 'Service included; small round-up common', region: 'Western Europe' },
  DE: { currency: 'Euro', currencyCode: 'EUR', tipping: '5-10% or round up', region: 'Western Europe' },
  ES: { currency: 'Euro', currencyCode: 'EUR', tipping: 'Small tips or round up', region: 'Southern Europe' },
  IT: { currency: 'Euro', currencyCode: 'EUR', tipping: 'Small tip/round up; coperto may apply', region: 'Southern Europe' },
  US: { currency: 'US Dollar', currencyCode: 'USD', tipping: '15-20% standard in restaurants', region: 'North America' },
  CA: { currency: 'Canadian Dollar', currencyCode: 'CAD', tipping: '15-20% standard in restaurants', region: 'North America' },
  MX: { currency: 'Mexican Peso', currencyCode: 'MXN', tipping: '10-15% standard', region: 'North America' },
  AE: { currency: 'UAE Dirham', currencyCode: 'AED', tipping: '10-15% if not included', region: 'Middle East' },
  SA: { currency: 'Saudi Riyal', currencyCode: 'SAR', tipping: '10-15% if not included', region: 'Middle East' },
  QA: { currency: 'Qatari Riyal', currencyCode: 'QAR', tipping: '10% where service not included', region: 'Middle East' },
  JM: { currency: 'Jamaican Dollar', currencyCode: 'JMD', tipping: '10-15% standard', region: 'Caribbean' },
  BB: { currency: 'Barbadian Dollar', currencyCode: 'BBD', tipping: '10-15% standard', region: 'Caribbean' },
  BS: { currency: 'Bahamian Dollar', currencyCode: 'BSD', tipping: '15% common', region: 'Caribbean' }
};
