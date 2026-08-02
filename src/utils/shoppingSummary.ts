import type { WebPartContext } from '@microsoft/sp-webpart-base';
import type { ShoppingItem } from '../services/ShoppingListService';
import type { TripMember } from '../models/TripMember';
import { assigneeLabelsMatch } from './tripMemberIdentity';
import { isAllSelected } from './multiSelectFilters';

export const SHOPPING_UNCATEGORISED = '__uncategorised__';
export const SHOPPING_UNSCHEDULED_MONTH = '__unscheduled__';

/** Empty selection = all categories. Items with no category match the uncategorised token. */
export function matchesShoppingCategories(category: string | undefined, selected: string[]): boolean {
  if (isAllSelected(selected)) return true;
  const cat = (category || '').trim();
  if (!cat) return selected.indexOf(SHOPPING_UNCATEGORISED) >= 0;
  return selected.some((s) => s.trim().toLowerCase() === cat.toLowerCase());
}

/** Empty selection = all months. Items with no month match the unscheduled token. */
export function matchesShoppingMonths(purchaseMonth: string | undefined, selected: string[]): boolean {
  if (!selected.length) return true;
  const month = (purchaseMonth || '').trim();
  if (!month) return selected.indexOf(SHOPPING_UNSCHEDULED_MONTH) >= 0;
  return selected.indexOf(month) >= 0;
}

export interface ShoppingTotals {
  budget: number;
  actual: number;
  count: number;
}

export interface ShoppingMonthRow {
  month: string;
  budget: number;
  actual: number;
  count: number;
}

function addToMap(map: Map<string, ShoppingTotals>, key: string, budget: number, actual: number): void {
  const row = map.get(key) ?? { budget: 0, actual: 0, count: 0 };
  row.budget += budget;
  row.actual += actual;
  row.count += 1;
  map.set(key, row);
}

export function summarizeShoppingItems(
  items: ShoppingItem[],
  travellerFilter: string | null,
  categoryFilters: string[],
  monthFilters: string[],
  ctx?: WebPartContext,
  members?: TripMember[]
): {
  totals: ShoppingTotals;
  byMonth: ShoppingMonthRow[];
  byTraveller: Map<string, ShoppingTotals>;
  byCategory: Map<string, ShoppingTotals>;
} {
  let filtered = items;
  if (travellerFilter === '__unassigned__') {
    filtered = filtered.filter((i) => !(i.traveller || '').trim());
  } else if (travellerFilter) {
    filtered = filtered.filter((i) =>
      ctx ? assigneeLabelsMatch(ctx, i.traveller, travellerFilter, members) : (i.traveller || '').trim() === travellerFilter
    );
  }
  filtered = filtered.filter((i) => matchesShoppingCategories(i.category, categoryFilters));
  filtered = filtered.filter((i) => matchesShoppingMonths(i.purchaseMonth, monthFilters));

  const totals: ShoppingTotals = { budget: 0, actual: 0, count: filtered.length };
  const monthMap = new Map<string, ShoppingTotals>();
  const travellerMap = new Map<string, ShoppingTotals>();
  const categoryMap = new Map<string, ShoppingTotals>();

  for (const item of filtered) {
    const budget = item.budgetAmount || 0;
    const actual = item.isPurchased ? item.actualAmount || item.budgetAmount || 0 : item.actualAmount || 0;
    totals.budget += budget;
    totals.actual += actual;
    const month = (item.purchaseMonth || 'Unscheduled').trim() || 'Unscheduled';
    addToMap(monthMap, month, budget, actual);
    const traveller = (item.traveller || 'Unassigned').trim() || 'Unassigned';
    addToMap(travellerMap, traveller, budget, actual);
    const category = (item.category || 'Uncategorised').trim() || 'Uncategorised';
    addToMap(categoryMap, category, budget, actual);
  }

  const byMonth = Array.from(monthMap.entries())
    .map(([month, row]) => ({ month, budget: row.budget, actual: row.actual, count: row.count }))
    .sort((a, b) => {
      if (a.month === 'Unscheduled') return 1;
      if (b.month === 'Unscheduled') return -1;
      return a.month.localeCompare(b.month);
    });

  return { totals, byMonth, byTraveller: travellerMap, byCategory: categoryMap };
}
