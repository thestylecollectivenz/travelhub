const KEY = 'travelhub-trip-shopping-categories-';

const DEFAULTS = ['Shoes', 'Tops', 'Bottoms', 'Toiletries', 'Accessories', 'Electronics', 'Other'];

export function loadTripShoppingCategories(tripId: string): string[] {
  try {
    const raw = window.localStorage.getItem(`${KEY}${tripId}`);
    if (!raw) return [...DEFAULTS];
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return [...DEFAULTS];
    const cats = parsed.filter((x) => typeof x === 'string' && x.trim()).map((x) => (x as string).trim());
    return cats.length ? cats : [...DEFAULTS];
  } catch {
    return [...DEFAULTS];
  }
}

export function rememberTripShoppingCategory(tripId: string, category: string): void {
  const trimmed = category.trim();
  if (!trimmed) return;
  const existing = loadTripShoppingCategories(tripId);
  if (existing.some((c) => c.toLowerCase() === trimmed.toLowerCase())) return;
  try {
    window.localStorage.setItem(`${KEY}${tripId}`, JSON.stringify([...existing, trimmed]));
  } catch {
    /* ignore */
  }
}
