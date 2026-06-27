import * as React from 'react';
import { usePlanView } from '../../context/PlanViewContext';
import { useTripWorkspace } from '../../context/TripWorkspaceContext';
import { useSpContext } from '../../context/SpContext';
import { useConfig } from '../../context/ConfigContext';
import { ShoppingListService, type ShoppingItem } from '../../services/ShoppingListService';
import { formatCurrency } from '../../utils/financialUtils';
import { categoriesForItemSelect, rememberTripShoppingCategory, notifyShoppingItemsChanged } from '../../utils/tripShoppingCategories';
import { useTripShoppingCategories } from '../../hooks/useTripShoppingCategories';
import { summarizeShoppingItems } from '../../utils/shoppingSummary';
import { confirmUserAction } from '../../utils/confirmAction';
import { useTripRole } from '../../context/TripRoleContext';
import { canEditOwnedRecord } from '../../utils/canEditOwnedRecord';
import { useCanSeeFinancials } from '../../hooks/useCanSeeFinancials';
import { useTripMembers } from '../../hooks/useTripMembers';
import { useCompanionListDefaults } from '../../hooks/useCompanionListDefaults';
import { assigneeLabelsMatch, resolveOwnerEmailForAssignee } from '../../utils/tripMemberIdentity';
import styles from './ShoppingListView.module.css';

export const ShoppingListView: React.FC = () => {
  const spContext = useSpContext();
  const { trip } = useTripWorkspace();
  const { config } = useConfig();
  const planView = usePlanView();
  const service = React.useMemo(() => new ShoppingListService(spContext), [spContext]);
  const { categories } = useTripShoppingCategories(trip?.id, spContext);
  const { role } = useTripRole();
  const { members, travellers } = useTripMembers(trip?.id);
  useCompanionListDefaults(planView, role, members);
  const canSeeFinancials = useCanSeeFinancials();
  const canEditItem = React.useCallback(
    (item: ShoppingItem) => canEditOwnedRecord(spContext, item.ownerEmail, role, item.traveller, members),
    [spContext, role, members]
  );
  const [items, setItems] = React.useState<ShoppingItem[]>([]);
  const [name, setName] = React.useState('');
  const [category, setCategory] = React.useState('');
  const [budget, setBudget] = React.useState('');
  const [purchaseMonth, setPurchaseMonth] = React.useState('');

  const activeTraveller = planView?.shoppingTraveller ?? null;
  const activeCategory = planView?.shoppingCategory ?? '__all__';
  const activeMonth = planView?.shoppingMonthFilter ?? null;

  React.useEffect(() => {
    if (category && !categories.some((c) => c.toLowerCase() === category.toLowerCase())) {
      setCategory('');
    }
  }, [categories, category]);

  const refresh = React.useCallback(() => {
    if (!trip?.id) return;
    service
      .getForTrip(trip.id)
      .then((rows) => {
        setItems(rows);
        notifyShoppingItemsChanged(trip.id);
      })
      .catch(console.error);
  }, [service, trip?.id]);

  React.useEffect(() => {
    refresh();
  }, [refresh]);

  const filtered = React.useMemo(() => {
    let rows = items;
    if (activeTraveller) {
      rows = rows.filter((i) =>
        assigneeLabelsMatch(spContext, i.traveller || travellers[0], activeTraveller, members)
      );
    }
    if (activeCategory !== '__all__') rows = rows.filter((i) => i.category === activeCategory);
    if (activeMonth) rows = rows.filter((i) => (i.purchaseMonth || '') === activeMonth);
    return rows;
  }, [items, activeTraveller, activeCategory, activeMonth, travellers, spContext, members]);

  const summary = React.useMemo(
    () => summarizeShoppingItems(items, activeTraveller, activeCategory, activeMonth, spContext, members),
    [items, activeTraveller, activeCategory, activeMonth, spContext, members]
  );

  const assignTraveller = activeTraveller || travellers[0] || 'Traveller 1';

  const addItem = (): void => {
    if (!trip?.id || !name.trim()) return;
    const cat = category.trim();
    if (!cat) return;
    rememberTripShoppingCategory(trip.id, cat);
    service
      .create({
        tripId: trip.id,
        itemName: name.trim(),
        category: cat,
        traveller: assignTraveller,
        budgetAmount: Math.max(0, Number(budget) || 0),
        actualAmount: 0,
        currency: config.homeCurrency,
        purchaseMonth: purchaseMonth.trim(),
        websiteUrl: '',
        notes: '',
        isPurchased: false,
        ownerEmail: resolveOwnerEmailForAssignee(spContext, assignTraveller, members)
      })
      .then(() => {
        setName('');
        setBudget('');
        refresh();
      })
      .catch(console.error);
  };

  const updateTraveller = (item: ShoppingItem, traveller: string): void => {
    service
      .update(item.id, {
        traveller,
        ownerEmail: resolveOwnerEmailForAssignee(spContext, traveller, members)
      })
      .then(refresh)
      .catch(console.error);
  };

  const categoryOptions = (itemCategory: string): string[] => categoriesForItemSelect(categories, itemCategory);

  return (
    <section className={styles.root} aria-label="Shopping list">
      <h2 className={styles.heading}>
        Shopping list
        {activeTraveller ? ` — ${activeTraveller}` : ' — All travellers'}
        {activeCategory !== '__all__' ? ` · ${activeCategory}` : ''}
        {activeMonth ? ` · ${activeMonth}` : ''}
      </h2>

      {canSeeFinancials ? (
        <div className={styles.summaryStrip}>
          <span className={styles.summaryChip}>
            Budget {formatCurrency(summary.totals.budget, config.homeCurrency)} · Actual{' '}
            {formatCurrency(summary.totals.actual, config.homeCurrency)} · {summary.totals.count} items
          </span>
        </div>
      ) : null}

      {categories.length === 0 ? (
        <p className={styles.muted}>Add shopping categories in the left sidebar (or mobile filters) before adding items.</p>
      ) : null}

      <div className={styles.row}>
        <input className={styles.input} placeholder="Item to buy" value={name} onChange={(e) => setName(e.target.value)} />
        <select
          className={styles.select}
          value={category}
          onChange={(e) => setCategory(e.target.value)}
          aria-label="Category"
          disabled={categories.length === 0}
        >
          <option value="">Select category…</option>
          {categories.map((c) => (
            <option key={c} value={c}>
              {c}
            </option>
          ))}
        </select>
        {canSeeFinancials ? (
          <input className={styles.input} placeholder="Budget $" value={budget} onChange={(e) => setBudget(e.target.value)} />
        ) : null}
        <input
          className={styles.input}
          type="month"
          value={purchaseMonth}
          onChange={(e) => setPurchaseMonth(e.target.value)}
          aria-label="Purchase month"
        />
        <button type="button" className={styles.button} onClick={addItem} disabled={!name.trim() || !category.trim() || categories.length === 0}>
          Add item
        </button>
      </div>

      <div className={styles.headerRow}>
        <span />
        <span>Item</span>
        <span>Category</span>
        <span>Traveller</span>
        {canSeeFinancials ? <span>Budget</span> : null}
        {canSeeFinancials ? <span>Actual</span> : null}
        <span>Month</span>
        <span>Link / notes</span>
        <span />
      </div>

      {filtered.length === 0 ? (
        <p className={styles.muted}>No shopping items yet.</p>
      ) : (
        filtered.map((item) => {
          const editable = canEditItem(item);
          return (
            <div key={item.id} className={`${styles.item} ${item.isPurchased ? styles.itemPurchased : ''}`}>
              <input
                type="checkbox"
                checked={item.isPurchased}
                aria-label="Purchased"
                disabled={!editable}
                onChange={(e) => service.update(item.id, { isPurchased: e.target.checked }).then(refresh).catch(console.error)}
              />
              <input
                className={styles.itemNameInput}
                defaultValue={item.itemName}
                disabled={!editable}
                aria-label="Item name"
                onBlur={(e) => {
                  if (!editable) return;
                  const v = e.target.value.trim();
                  if (v && v !== item.itemName) service.update(item.id, { itemName: v }).then(refresh).catch(console.error);
                }}
              />
              <select
                className={styles.select}
                value={item.category || ''}
                disabled={!editable}
                onChange={(e) => {
                  const next = e.target.value;
                  if (trip?.id && next) rememberTripShoppingCategory(trip.id, next);
                  service.update(item.id, { category: next }).then(refresh).catch(console.error);
                }}
              >
                <option value="">Uncategorised</option>
                {categoryOptions(item.category).map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </select>
              <select
                className={styles.select}
                value={item.traveller || travellers[0]}
                disabled={!editable}
                onChange={(e) => updateTraveller(item, e.target.value)}
              >
                {travellers.map((t) => (
                  <option key={t} value={t}>
                    {t}
                  </option>
                ))}
              </select>
              {canSeeFinancials ? (
                <input
                  className={styles.moneyInput}
                  type="number"
                  min={0}
                  step="0.01"
                  value={item.budgetAmount || ''}
                  disabled={!editable}
                  onChange={(e) => {
                    const v = Math.max(0, Number(e.target.value) || 0);
                    service.update(item.id, { budgetAmount: v }).then(refresh).catch(console.error);
                  }}
                />
              ) : null}
              {canSeeFinancials ? (
                <input
                  className={styles.moneyInput}
                  type="number"
                  min={0}
                  step="0.01"
                  value={item.actualAmount || ''}
                  disabled={!editable}
                  onChange={(e) => {
                    const v = Math.max(0, Number(e.target.value) || 0);
                    service.update(item.id, { actualAmount: v }).then(refresh).catch(console.error);
                  }}
                />
              ) : null}
              <input
                className={styles.input}
                type="month"
                value={item.purchaseMonth || ''}
                disabled={!editable}
                onChange={(e) => service.update(item.id, { purchaseMonth: e.target.value }).then(refresh).catch(console.error)}
              />
              <div className={styles.linkNotes}>
                <input
                  className={styles.linkInput}
                  placeholder="Website URL"
                  defaultValue={item.websiteUrl}
                  disabled={!editable}
                  onBlur={(e) => {
                    if (!editable) return;
                    const v = e.target.value.trim();
                    if (v !== (item.websiteUrl || '')) service.update(item.id, { websiteUrl: v }).then(refresh).catch(console.error);
                  }}
                />
                <input
                  className={styles.noteInput}
                  placeholder="Notes"
                  defaultValue={item.notes}
                  disabled={!editable}
                  onBlur={(e) => {
                    if (!editable) return;
                    const v = e.target.value.trim();
                    if (v !== (item.notes || '')) service.update(item.id, { notes: v }).then(refresh).catch(console.error);
                  }}
                />
              </div>
              {editable ? (
                <button
                  type="button"
                  className={styles.deleteBtn}
                  onClick={() => {
                    void (async () => {
                      if (!(await confirmUserAction('Delete this shopping item?'))) return;
                      service.delete(item.id).then(refresh).catch(console.error);
                    })();
                  }}
                >
                  Delete
                </button>
              ) : null}
            </div>
          );
        })
      )}
    </section>
  );
};
