import type { BudgetCategoryKey } from './financialUtils';
import { BUDGET_CATEGORY_ORDER } from './financialUtils';

function isBudgetCategoryKey(value: string): value is BudgetCategoryKey {
  return BUDGET_CATEGORY_ORDER.some((k) => k === value);
}

/** Timeline node border / edit fill — CSS color values only (vars). */
export function categoryNodeColor(category: string): string {
  const key: BudgetCategoryKey = isBudgetCategoryKey(category) ? category : 'Other';
  const map: Record<BudgetCategoryKey, string> = {
    Flights: 'var(--color-blue-400)',
    Accommodation: 'var(--color-teal-400)',
    'Food & Dining': 'var(--color-amber-400)',
    Activities: 'var(--color-green-400)',
    Transport: 'var(--color-teal-600)',
    'Travel Overheads': 'var(--color-teal-500)',
    Preparation: 'var(--color-purple-400)',
    Other: 'var(--color-sand-400)'
  };
  return map[key];
}
