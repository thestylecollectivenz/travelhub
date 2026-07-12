export type BookingAffiliateCategory = 'stays' | 'flights' | 'tours' | 'audio' | 'transport';

export interface BookingAffiliateLink {
  id: string;
  label: string;
  description: string;
  category: BookingAffiliateCategory;
  href: string;
}

const CATEGORY_LABELS: Record<BookingAffiliateCategory, string> = {
  stays: 'Stays',
  flights: 'Flights',
  tours: 'Tours & activities',
  audio: 'Audio guides',
  transport: 'Transport'
};

export function bookingAffiliateCategoryLabel(category: BookingAffiliateCategory): string {
  return CATEGORY_LABELS[category];
}

/** Curated affiliate / partner booking links for the mobile Book hub. */
export function homeBookingAffiliateLinks(destination = ''): BookingAffiliateLink[] {
  const q = encodeURIComponent(destination.trim() || 'travel');
  return [
    {
      id: 'expedia',
      label: 'Expedia',
      description: 'Hotels, flights, and packages',
      category: 'stays',
      href: `https://www.expedia.com/Hotel-Search?destination=${q}`
    },
    {
      id: 'booking',
      label: 'Booking.com',
      description: 'Hotels and apartments worldwide',
      category: 'stays',
      href: `https://www.booking.com/searchresults.html?ss=${q}`
    },
    {
      id: 'skyscanner',
      label: 'Skyscanner',
      description: 'Compare flights',
      category: 'flights',
      href: `https://www.skyscanner.net/transport/flights/?adultsv2=1&originentityid=27544008&destinationentityid=27539774`
    },
    {
      id: 'getyourguide',
      label: 'GetYourGuide',
      description: 'Tours, tickets, and day trips',
      category: 'tours',
      href: `https://www.getyourguide.com/s/?q=${q}`
    },
    {
      id: 'viator',
      label: 'Viator',
      description: 'Experiences and excursions',
      category: 'tours',
      href: `https://www.viator.com/searchResults/all?text=${q}`
    },
    {
      id: 'voicemap',
      label: 'VoiceMap',
      description: 'Self-guided audio walking tours',
      category: 'audio',
      href: `https://voicemap.me/search?q=${q}`
    },
    {
      id: 'rome2rio',
      label: 'Rome2Rio',
      description: 'How to get there by any mode',
      category: 'transport',
      href: `https://www.rome2rio.com/map/${q}`
    }
  ];
}

export function groupBookingAffiliateLinks(
  links: BookingAffiliateLink[]
): Array<{ category: BookingAffiliateCategory; label: string; items: BookingAffiliateLink[] }> {
  const order: BookingAffiliateCategory[] = ['stays', 'flights', 'tours', 'audio', 'transport'];
  return order
    .map((category) => ({
      category,
      label: CATEGORY_LABELS[category],
      items: links.filter((l) => l.category === category)
    }))
    .filter((g) => g.items.length > 0);
}
