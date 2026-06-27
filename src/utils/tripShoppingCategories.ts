const KEY = 'travelhub-trip-shopping-categories-';

export const SHOPPING_CATEGORIES_CHANGED_EVENT = 'travelhub-shopping-categories-changed';

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
  return out;
}

export function loadTripShoppingCategories(tripId: string): string[] {
  try {
    const raw = window.localStorage.getItem(`${KEY}${tripId}`);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return [];
    return normalizeList(parsed.filter((x) => typeof x === 'string') as string[]);
  } catch {
    return [];
  }
}

export function saveTripShoppingCategories(tripId: string, categories: string[]): string[] {
  const normalized = normalizeList(categories);
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
