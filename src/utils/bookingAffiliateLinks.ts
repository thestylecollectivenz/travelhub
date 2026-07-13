export type BookingAffiliateCategory =
  | 'stays'
  | 'flights'
  | 'tours'
  | 'travelMoney'
  | 'transport'
  | 'esim'
  | 'audio';

export interface BookingAffiliatePartnerDef {
  id: string;
  label: string;
  description: string;
  category: BookingAffiliateCategory;
  logoDomain: string;
  recommended: boolean;
  sortOrder: number;
  hrefTemplate: string;
  /** Query param name for affiliate / partner id, e.g. aid */
  affiliateQueryParam?: string;
}

export interface BookingAffiliatePartnerOverride {
  enabled?: boolean;
  recommended?: boolean;
  sortOrder?: number;
  affiliateId?: string;
  hrefOverride?: string;
}

export type BookingAffiliateOverridesMap = Record<string, BookingAffiliatePartnerOverride>;

export interface ResolvedBookingAffiliatePartner {
  id: string;
  label: string;
  description: string;
  category: BookingAffiliateCategory;
  logoUrl: string;
  href: string;
  recommended: boolean;
  sortOrder: number;
}

export const BOOKING_AFFILIATES_CONFIG_KEY = 'booking.affiliates.v1';

const CATEGORY_LABELS: Record<BookingAffiliateCategory, string> = {
  stays: 'Stays',
  flights: 'Flights',
  tours: 'Tours & Activities',
  travelMoney: 'Travel Money',
  transport: 'Transport',
  esim: 'Travel eSIM',
  audio: 'Audio guides'
};

const CATEGORY_ORDER: BookingAffiliateCategory[] = [
  'stays',
  'flights',
  'tours',
  'travelMoney',
  'transport',
  'esim',
  'audio'
];

export function bookingAffiliateCategoryLabel(category: BookingAffiliateCategory): string {
  return CATEGORY_LABELS[category];
}

export function partnerLogoUrl(logoDomain: string): string {
  const domain = (logoDomain || '').trim() || 'example.com';
  return `https://www.google.com/s2/favicons?domain=${encodeURIComponent(domain)}&sz=128`;
}

/** Built-in partner catalog — href templates accept `{destination}` placeholder. */
export const DEFAULT_BOOKING_AFFILIATE_PARTNERS: BookingAffiliatePartnerDef[] = [
  {
    id: 'tripadvisor',
    label: 'Tripadvisor',
    description: 'Reviews, comparisons & hotel prices',
    category: 'stays',
    logoDomain: 'tripadvisor.com',
    recommended: true,
    sortOrder: 10,
    hrefTemplate: 'https://www.tripadvisor.com/Search?q={destination}'
  },
  {
    id: 'booking',
    label: 'Booking.com',
    description: 'Hotels, apartments & more',
    category: 'stays',
    logoDomain: 'booking.com',
    recommended: true,
    sortOrder: 20,
    hrefTemplate: 'https://www.booking.com/searchresults.html?ss={destination}',
    affiliateQueryParam: 'aid'
  },
  {
    id: 'expedia',
    label: 'Expedia',
    description: 'Hotels, flights, cars & packages',
    category: 'stays',
    logoDomain: 'expedia.com',
    recommended: true,
    sortOrder: 30,
    hrefTemplate: 'https://www.expedia.com/Hotel-Search?destination={destination}'
  },
  {
    id: 'skyscanner',
    label: 'Skyscanner',
    description: 'Compare flights from 1000s of airlines',
    category: 'flights',
    logoDomain: 'skyscanner.net',
    recommended: true,
    sortOrder: 40,
    hrefTemplate: 'https://www.skyscanner.net/transport/flights/?adultsv2=1&qprefs=0&query={destination}'
  },
  {
    id: 'getyourguide',
    label: 'GetYourGuide',
    description: 'Tours, tickets & day trips',
    category: 'tours',
    logoDomain: 'getyourguide.com',
    recommended: true,
    sortOrder: 50,
    hrefTemplate: 'https://www.getyourguide.com/s/?q={destination}',
    affiliateQueryParam: 'partner_id'
  },
  {
    id: 'wise',
    label: 'Wise',
    description: 'Pay, spend & send money worldwide',
    category: 'travelMoney',
    logoDomain: 'wise.com',
    recommended: true,
    sortOrder: 60,
    hrefTemplate: 'https://wise.com/',
    affiliateQueryParam: 'referral'
  },
  {
    id: 'viator',
    label: 'Viator',
    description: 'Experiences and excursions',
    category: 'tours',
    logoDomain: 'viator.com',
    recommended: false,
    sortOrder: 110,
    hrefTemplate: 'https://www.viator.com/searchResults/all?text={destination}',
    affiliateQueryParam: 'pid'
  },
  {
    id: 'klook',
    label: 'Klook',
    description: 'Activities & attraction tickets',
    category: 'tours',
    logoDomain: 'klook.com',
    recommended: false,
    sortOrder: 120,
    hrefTemplate: 'https://www.klook.com/search/result/?query={destination}',
    affiliateQueryParam: 'aid'
  },
  {
    id: 'omio',
    label: 'Omio',
    description: 'Trains, buses & ferries compared',
    category: 'transport',
    logoDomain: 'omio.com',
    recommended: false,
    sortOrder: 130,
    hrefTemplate: 'https://www.omio.com/search/{destination}'
  },
  {
    id: 'trainline',
    label: 'Trainline',
    description: 'Train tickets across Europe',
    category: 'transport',
    logoDomain: 'trainline.com',
    recommended: false,
    sortOrder: 140,
    hrefTemplate: 'https://www.thetrainline.com/search/{destination}'
  },
  {
    id: 'airalo',
    label: 'Airalo',
    description: 'Travel eSIM data plans',
    category: 'esim',
    logoDomain: 'airalo.com',
    recommended: false,
    sortOrder: 150,
    hrefTemplate: 'https://www.airalo.com/',
    affiliateQueryParam: 'ref'
  },
  {
    id: 'voicemap',
    label: 'VoiceMap',
    description: 'Self-guided audio walking tours',
    category: 'audio',
    logoDomain: 'voicemap.me',
    recommended: false,
    sortOrder: 160,
    hrefTemplate: 'https://voicemap.me/search?q={destination}'
  },
  {
    id: 'rome2rio',
    label: 'Rome2Rio',
    description: 'How to get there by any mode',
    category: 'transport',
    logoDomain: 'rome2rio.com',
    recommended: false,
    sortOrder: 170,
    hrefTemplate: 'https://www.rome2rio.com/map/{destination}'
  }
];

function parseOverridesJson(raw?: string): BookingAffiliateOverridesMap {
  const text = (raw || '').trim();
  if (!text) return {};
  try {
    const parsed = JSON.parse(text) as unknown;
    if (!parsed || typeof parsed !== 'object') return {};
    return parsed as BookingAffiliateOverridesMap;
  } catch {
    return {};
  }
}

export function parseBookingAffiliateOverrides(raw?: string): BookingAffiliateOverridesMap {
  return parseOverridesJson(raw);
}

export function serializeBookingAffiliateOverrides(map: BookingAffiliateOverridesMap): string {
  return JSON.stringify(map, null, 2);
}

function buildHref(def: BookingAffiliatePartnerDef, destination: string, override?: BookingAffiliatePartnerOverride): string {
  const dest = encodeURIComponent(destination.trim() || 'travel');
  let url = (override?.hrefOverride || def.hrefTemplate).replace(/\{destination\}/g, dest);
  const affiliateId = (override?.affiliateId || '').trim();
  if (affiliateId && def.affiliateQueryParam) {
    const sep = url.includes('?') ? '&' : '?';
    url += `${sep}${def.affiliateQueryParam}=${encodeURIComponent(affiliateId)}`;
  }
  return url;
}

export function resolveBookingAffiliatePartners(
  destination = '',
  overridesJson?: string
): ResolvedBookingAffiliatePartner[] {
  const overrides = parseOverridesJson(overridesJson);
  return DEFAULT_BOOKING_AFFILIATE_PARTNERS.map((def) => {
    const o = overrides[def.id];
    const enabled = o?.enabled !== false;
    if (!enabled) return null;
    return {
      id: def.id,
      label: def.label,
      description: def.description,
      category: def.category,
      logoUrl: partnerLogoUrl(def.logoDomain),
      href: buildHref(def, destination, o),
      recommended: o?.recommended ?? def.recommended,
      sortOrder: o?.sortOrder ?? def.sortOrder
    };
  })
    .filter((p): p is ResolvedBookingAffiliatePartner => Boolean(p))
    .sort((a, b) => a.sortOrder - b.sortOrder || a.label.localeCompare(b.label));
}

export function recommendedBookingPartners(partners: ResolvedBookingAffiliatePartner[]): ResolvedBookingAffiliatePartner[] {
  return partners.filter((p) => p.recommended);
}

export function moreBookingPartners(partners: ResolvedBookingAffiliatePartner[]): ResolvedBookingAffiliatePartner[] {
  return partners.filter((p) => !p.recommended);
}

export function groupBookingPartnersByCategory(
  partners: ResolvedBookingAffiliatePartner[]
): Array<{ category: BookingAffiliateCategory; label: string; items: ResolvedBookingAffiliatePartner[] }> {
  return CATEGORY_ORDER.map((category) => ({
    category,
    label: CATEGORY_LABELS[category],
    items: partners.filter((p) => p.category === category)
  })).filter((g) => g.items.length > 0);
}

/** @deprecated use resolveBookingAffiliatePartners */
export function homeBookingAffiliateLinks(destination = ''): ResolvedBookingAffiliatePartner[] {
  return resolveBookingAffiliatePartners(destination);
}

/** @deprecated use groupBookingPartnersByCategory */
export function groupBookingAffiliateLinks(
  links: ResolvedBookingAffiliatePartner[]
): Array<{ category: BookingAffiliateCategory; label: string; items: ResolvedBookingAffiliatePartner[] }> {
  return groupBookingPartnersByCategory(links);
}
