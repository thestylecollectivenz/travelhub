import type { WebPartContext } from '@microsoft/sp-webpart-base';
import type { ShoppingItem } from '../services/ShoppingListService';
import type { TripMember } from '../models/TripMember';
import { assigneeLabelsMatch } from './tripMemberIdentity';

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
  categoryFilter: string | null,
  monthFilter: string | null,
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
  if (categoryFilter === '__uncategorised__') {
    filtered = filtered.filter((i) => !(i.category || '').trim());
  } else if (categoryFilter && categoryFilter !== '__all__') {
    filtered = filtered.filter((i) => i.category === categoryFilter);
  }
  if (monthFilter === '__unscheduled__') {
    filtered = filtered.filter((i) => !(i.purchaseMonth || '').trim());
  } else if (monthFilter) {
    filtered = filtered.filter((i) => (i.purchaseMonth || '').trim() === monthFilter);
  }

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
