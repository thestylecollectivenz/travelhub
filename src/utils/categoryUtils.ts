export const CATEGORY_LIST = [
  'Flights',
  'Accommodation',
  'Cruise',
  'Food & Dining',
  'Activities',
  'Transport',
  'Travel Overheads',
  'Preparation',
  'Other'
] as const;

export type CategoryName = (typeof CATEGORY_LIST)[number];

export function getCategoryColor(category: string): string {
  switch (category) {
    case 'Flights':
      return 'var(--color-cat-flights)';
    case 'Accommodation':
      return 'var(--color-cat-accommodation)';
    case 'Cruise':
      return 'var(--color-cat-cruise)';
    case 'Food & Dining':
      return 'var(--color-cat-food)';
    case 'Activities':
      return 'var(--color-cat-activities)';
    case 'Transport':
      return 'var(--color-cat-transport)';
    case 'Travel Overheads':
      return 'var(--color-cat-overheads)';
    case 'Preparation':
      return 'var(--color-cat-preparation)';
    default:
      return 'var(--color-cat-other)';
  }
}

export function getCategoryBgColor(category: string): string {
  switch (category) {
    case 'Flights':
      return 'var(--color-cat-flights-bg)';
    case 'Accommodation':
      return 'var(--color-cat-accommodation-bg)';
    case 'Cruise':
      return 'var(--color-cat-cruise-bg)';
    case 'Food & Dining':
      return 'var(--color-cat-food-bg)';
    case 'Activities':
      return 'var(--color-cat-activities-bg)';
    case 'Transport':
      return 'var(--color-cat-transport-bg)';
    case 'Travel Overheads':
      return 'var(--color-cat-overheads-bg)';
    case 'Preparation':
      return 'var(--color-cat-preparation-bg)';
    default:
      return 'var(--color-cat-other-bg)';
  }
}

export function getCategoryColorValue(category: string): string {
  return getCategoryColor(category);
}

export function getCategorySlug(category: string): string {
  switch (category) {
    case 'Flights':
      return 'flights';
    case 'Accommodation':
      return 'accommodation';
    case 'Cruise':
      return 'cruise';
    case 'Food & Dining':
      return 'food';
    case 'Activities':
      return 'activities';
    case 'Transport':
      return 'transport';
    case 'Travel Overheads':
      return 'overheads';
    case 'Preparation':
      return 'preparation';
    default:
      return 'other';
  }
}
