export function getCategoryColor(category: string): string {
  switch (category) {
    case 'Flights':
      return 'var(--color-cat-flights)';
    case 'Accommodation':
      return 'var(--color-cat-accommodation)';
    case 'Food & Dining':
      return 'var(--color-cat-food)';
    case 'Activities':
      return 'var(--color-cat-activities)';
    case 'Transport':
      return 'var(--color-cat-transport)';
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
    case 'Food & Dining':
      return 'var(--color-cat-food-bg)';
    case 'Activities':
      return 'var(--color-cat-activities-bg)';
    case 'Transport':
      return 'var(--color-cat-transport-bg)';
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
    case 'Food & Dining':
      return 'food';
    case 'Activities':
      return 'activities';
    case 'Transport':
      return 'transport';
    default:
      return 'other';
  }
}
