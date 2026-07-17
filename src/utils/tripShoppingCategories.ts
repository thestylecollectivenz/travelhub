/** Shared taxonomy for packing + shopping list category filters. */
export const DEFAULT_SHARED_LIST_CATEGORIES = [
  'Clothing',
  'Shoes',
  'Accessories',
  'Underwear & sleepwear',
  'Outerwear',
  'Swimwear',
  'Toiletries',
  'Medications',
  'First aid',
  'Electronics',
  'Chargers & cables',
  'Documents',
  'Money & cards',
  'Bags',
  'Laundry',
  'Beach & pool',
  'Sports & activity',
  'Kids',
  'Food & snacks',
  'Drinks',
  'Souvenirs & gifts',
  'Household',
  'Other'
];

const KEY = 'travelhub-trip-shopping-categories-';

export const SHOPPING_CATEGORIES_CHANGED_EVENT = 'travelhub-shopping-categories-changed';
export const SHOPPING_ITEMS_CHANGED_EVENT = 'travelhub-shopping-items-changed';
/** Alias — packing and shopping share one category store. */
export const LIST_CATEGORIES_CHANGED_EVENT = SHOPPING_CATEGORIES_CHANGED_EVENT;

export function notifyShoppingItemsChanged(tripId: string): void {
  window.dispatchEvent(
    new CustomEvent<{ tripId: string }>(SHOPPING_ITEMS_CHANGED_EVENT, {
      detail: { tripId }
    })
  );
}

function normalizeList(categories: string[]): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const raw of categories) {
    const trimmed = raw.trim();
    if (!trimmed) continue;
    const key = trimmed.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(trimmed);
  }
  return out.sort((a, b) => a.localeCompare(b, undefined, { sensitivity: 'base' }));
}

/** Always include the full default set, then any custom categories the trip added. */
function mergeWithDefaults(saved: string[]): string[] {
  return normalizeList([...DEFAULT_SHARED_LIST_CATEGORIES, ...saved]);
}

export function loadTripShoppingCategories(tripId: string): string[] {
  try {
    const raw = window.localStorage.getItem(`${KEY}${tripId}`);
    if (!raw) {
      return saveTripShoppingCategories(tripId, DEFAULT_SHARED_LIST_CATEGORIES);
    }
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) {
      return saveTripShoppingCategories(tripId, DEFAULT_SHARED_LIST_CATEGORIES);
    }
    const saved = normalizeList(parsed.filter((x) => typeof x === 'string') as string[]);
    const merged = mergeWithDefaults(saved);
    // Backfill defaults if an older culled list was stored.
    if (merged.length !== saved.length) {
      return saveTripShoppingCategories(tripId, merged);
    }
    return merged.length ? merged : saveTripShoppingCategories(tripId, DEFAULT_SHARED_LIST_CATEGORIES);
  } catch {
    return [...DEFAULT_SHARED_LIST_CATEGORIES];
  }
}

export function saveTripShoppingCategories(tripId: string, categories: string[]): string[] {
  const normalized = mergeWithDefaults(categories);
  try {
    window.localStorage.setItem(`${KEY}${tripId}`, JSON.stringify(normalized));
  } catch {
    /* ignore */
  }
  notifyShoppingCategoriesChanged(tripId);
  return normalized;
}

export function rememberTripShoppingCategory(tripId: string, category: string): string[] {
  const trimmed = category.trim();
  if (!trimmed) return loadTripShoppingCategories(tripId);
  const existing = loadTripShoppingCategories(tripId);
  if (existing.some((c) => c.toLowerCase() === trimmed.toLowerCase())) return existing;
  return saveTripShoppingCategories(tripId, [...existing, trimmed]);
}

export function renameTripShoppingCategory(tripId: string, oldName: string, newName: string): string[] {
  const trimmedNew = newName.trim();
  if (!trimmedNew) return loadTripShoppingCategories(tripId);
  const existing = loadTripShoppingCategories(tripId);
  const next = normalizeList(
    existing.map((c) => (c.toLowerCase() === oldName.trim().toLowerCase() ? trimmedNew : c))
  );
  return saveTripShoppingCategories(tripId, next);
}

export function deleteTripShoppingCategory(tripId: string, category: string): string[] {
  const key = category.trim().toLowerCase();
  // Keep defaults — only remove custom categories from the stored list after merge.
  if (DEFAULT_SHARED_LIST_CATEGORIES.some((c) => c.toLowerCase() === key)) {
    return loadTripShoppingCategories(tripId);
  }
  const existing = loadTripShoppingCategories(tripId);
  return saveTripShoppingCategories(
    tripId,
    existing.filter((c) => c.toLowerCase() !== key)
  );
}

/** Include a legacy/orphan category on an item row when it is not in the saved list. */
export function categoriesForItemSelect(saved: string[], itemCategory: string): string[] {
  const trimmed = itemCategory.trim();
  if (!trimmed) return saved;
  if (saved.some((c) => c.toLowerCase() === trimmed.toLowerCase())) return saved;
  return [...saved, trimmed];
}

export function notifyShoppingCategoriesChanged(tripId: string): void {
  window.dispatchEvent(
    new CustomEvent<{ tripId: string }>(SHOPPING_CATEGORIES_CHANGED_EVENT, {
      detail: { tripId }
    })
  );
}

/** Same store as shopping — use for packing filters/selects. */
export const loadTripListCategories = loadTripShoppingCategories;
export const rememberTripListCategory = rememberTripShoppingCategory;
export const saveTripListCategories = saveTripShoppingCategories;
