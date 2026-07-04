import * as React from 'react';
import { usePlanView } from '../../context/PlanViewContext';
import { useTripWorkspace } from '../../context/TripWorkspaceContext';
import { useSpContext } from '../../context/SpContext';
import { useConfig } from '../../context/ConfigContext';
import { ShoppingListService } from '../../services/ShoppingListService';
import { formatCurrency } from '../../utils/financialUtils';
import { summarizeShoppingItems } from '../../utils/shoppingSummary';
import { SHOPPING_ITEMS_CHANGED_EVENT } from '../../utils/tripShoppingCategories';
import { useTripMembers } from '../../hooks/useTripMembers';
import styles from './RightPaneInsights.module.css';

const ALL_CATEGORIES = '__all__';
const UNCATEGORISED = '__uncategorised__';
const UNSCHEDULED_MONTH = '__unscheduled__';

export const RightPaneShoppingSummary: React.FC = () => {
  const spContext = useSpContext();
  const { trip } = useTripWorkspace();
  const { config } = useConfig();
  const planView = usePlanView();
  const { members } = useTripMembers(trip?.id);
  const [items, setItems] = React.useState<Awaited<ReturnType<ShoppingListService['getForTrip']>>>([]);

  const reload = React.useCallback(() => {
    if (!trip?.id) return;
    const svc = new ShoppingListService(spContext);
    svc.getForTrip(trip.id).then(setItems).catch(console.error);
  }, [trip?.id, spContext]);

  React.useEffect(() => {
    reload();
  }, [reload]);

  React.useEffect(() => {
    const onChanged = (event: Event): void => {
      const detail = (event as CustomEvent<{ tripId: string }>).detail;
      if (trip?.id && detail?.tripId === trip.id) reload();
    };
    window.addEventListener(SHOPPING_ITEMS_CHANGED_EVENT, onChanged);
    return () => window.removeEventListener(SHOPPING_ITEMS_CHANGED_EVENT, onChanged);
  }, [trip?.id, reload]);

  const activeCategory = planView?.shoppingCategory ?? ALL_CATEGORIES;
  const activeMonth = planView?.shoppingMonthFilter ?? null;
  const activeTraveller = planView?.shoppingTraveller ?? null;

  const summary = React.useMemo(
    () =>
      summarizeShoppingItems(
        items,
        activeTraveller,
        activeCategory,
        activeMonth,
        spContext,
        members
      ),
    [items, activeTraveller, activeCategory, activeMonth, spContext, members]
  );

  if (!trip || !planView) return null;
  const home = config.homeCurrency;
  const categories = Array.from(summary.byCategory.entries()).sort((a, b) => a[0].localeCompare(b[0]));

  const categoryKey = (name: string): string => (name === 'Uncategorised' ? UNCATEGORISED : name);
  const monthKey = (name: string): string | null => (name === 'Unscheduled' ? UNSCHEDULED_MONTH : name);
  const travellerKey = (name: string): string | null => (name === 'Unassigned' ? '__unassigned__' : name);

  const itemClass = (active: boolean): string =>
    `${styles.listItem} ${styles.clickableItem}${active ? ` ${styles.clickableItemActive}` : ''}`;

  return (
    <section className={styles.root} aria-label="Shopping summary">
      <h2 className={styles.heading}>Shopping spend</h2>
      <div className={styles.statGrid}>
        <div className={styles.stat}>
          <span className={styles.statValue}>{formatCurrency(summary.totals.budget, home)}</span>
          <span className={styles.statLabel}>Budget total</span>
        </div>
        <div className={styles.stat}>
          <span className={styles.statValue}>{formatCurrency(summary.totals.actual, home)}</span>
          <span className={styles.statLabel}>Actual spent</span>
        </div>
        <div className={styles.stat}>
          <span className={styles.statValue}>{summary.totals.count}</span>
          <span className={styles.statLabel}>Items</span>
        </div>
      </div>

      <h3 className={styles.subheading}>By category</h3>
      <ul className={styles.list}>
        <li>
          <button
            type="button"
            className={itemClass(activeCategory === ALL_CATEGORIES)}
            onClick={() => planView.setShoppingCategory(ALL_CATEGORIES)}
          >
            <strong>All categories</strong>
          </button>
        </li>
        {categories.length === 0 ? (
          <li className={styles.muted}>No items yet.</li>
        ) : (
          categories.map(([name, row]) => {
            const key = categoryKey(name);
            return (
              <li key={name}>
                <button
                  type="button"
                  className={itemClass(activeCategory === key)}
                  onClick={() => planView.setShoppingCategory(key)}
                >
                  <strong>{name}</strong> · Budget {formatCurrency(row.budget, home)} · Actual{' '}
                  {formatCurrency(row.actual, home)} · {row.count} item{row.count === 1 ? '' : 's'}
                </button>
              </li>
            );
          })
        )}
      </ul>

      <h3 className={styles.subheading}>By month</h3>
      <ul className={styles.list}>
        <li>
          <button
            type="button"
            className={itemClass(activeMonth === null)}
            onClick={() => planView.setShoppingMonthFilter(null)}
          >
            <strong>All months</strong>
          </button>
        </li>
        {summary.byMonth.length === 0 ? (
          <li className={styles.muted}>No items scheduled.</li>
        ) : (
          summary.byMonth.map((row) => {
            const key = monthKey(row.month);
            return (
              <li key={row.month}>
                <button
                  type="button"
                  className={itemClass(activeMonth === key)}
                  onClick={() => planView.setShoppingMonthFilter(key)}
                >
                  <strong>{row.month}</strong> · Budget {formatCurrency(row.budget, home)} · Actual{' '}
                  {formatCurrency(row.actual, home)} · {row.count} item{row.count === 1 ? '' : 's'}
                </button>
              </li>
            );
          })
        )}
      </ul>

      <h3 className={styles.subheading}>By traveller</h3>
      <ul className={styles.list}>
        <li>
          <button
            type="button"
            className={itemClass(activeTraveller === null)}
            onClick={() => planView.setShoppingTraveller(null)}
          >
            <strong>All travellers</strong>
          </button>
        </li>
        {Array.from(summary.byTraveller.entries())
          .sort((a, b) => a[0].localeCompare(b[0]))
          .map(([name, row]) => {
            const key = travellerKey(name);
            return (
              <li key={name}>
                <button
                  type="button"
                  className={itemClass(activeTraveller === key)}
                  onClick={() => planView.setShoppingTraveller(key)}
                >
                  <strong>{name}</strong> · Budget {formatCurrency(row.budget, home)} · Actual{' '}
                  {formatCurrency(row.actual, home)}
                </button>
              </li>
            );
          })}
      </ul>
    </section>
  );
};
