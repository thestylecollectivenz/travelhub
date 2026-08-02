/**
 * Helpers for checkbox-style multi-select filters.
 *
 * An empty selection always means "everything". The `__all__` token is still accepted
 * so older persisted/single-value call sites keep working.
 */

export const ALL_FILTER_TOKEN = '__all__';

export function isAllSelected(selected: string[], allToken: string = ALL_FILTER_TOKEN): boolean {
  return selected.length === 0 || selected.indexOf(allToken) >= 0;
}

/** Category-flavoured alias of {@link isAllSelected}. */
export function isAllCategories(selected: string[], allToken: string = ALL_FILTER_TOKEN): boolean {
  return isAllSelected(selected, allToken);
}

/** Toggling the all-token clears the selection; toggling a value adds/removes it. */
export function toggleMulti(selected: string[], value: string, allToken: string = ALL_FILTER_TOKEN): string[] {
  if (value === allToken) return [];
  const cleaned = selected.filter((v) => v !== allToken);
  return cleaned.indexOf(value) >= 0 ? cleaned.filter((v) => v !== value) : [...cleaned, value];
}

/** True when the row should render as ticked (the all-token ticks when nothing is selected). */
export function isOptionSelected(selected: string[], value: string, allToken: string = ALL_FILTER_TOKEN): boolean {
  if (value === allToken) return isAllSelected(selected, allToken);
  return selected.indexOf(value) >= 0;
}

/** Case-insensitive membership test used by packing/shopping category filters. */
export function matchesAnySelected(
  value: string,
  selected: string[],
  allToken: string = ALL_FILTER_TOKEN
): boolean {
  if (isAllSelected(selected, allToken)) return true;
  const needle = value.trim().toLowerCase();
  return selected.some((s) => s.trim().toLowerCase() === needle);
}

/** Replaces a renamed value in a selection, preserving order. */
export function renameInMulti(selected: string[], from: string, to: string): string[] {
  return selected.map((v) => (v === from ? to : v));
}
