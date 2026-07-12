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
import { offerAddPurchasedShoppingToPacking } from '../../utils/shoppingToPacking';
import { useTripRole } from '../../context/TripRoleContext';
import { canEditOwnedRecord } from '../../utils/canEditOwnedRecord';
import { useCanSeeFinancials } from '../../hooks/useCanSeeFinancials';
import { useTripMembers } from '../../hooks/useTripMembers';
import { useCompanionListDefaults } from '../../hooks/useCompanionListDefaults';
import { assigneeLabelsMatch, resolveOwnerEmailForAssignee } from '../../utils/tripMemberIdentity';
import styles from './MobileShell.module.css';

export const MobileShoppingList: React.FC<{ embedded?: boolean }> = ({ embedded = false }) => {
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
  const [items, setItems] = React.useState<ShoppingItem[]>([]);
  const [addOpen, setAddOpen] = React.useState(false);
  const [expandedId, setExpandedId] = React.useState<string | null>(null);
  const [name, setName] = React.useState('');
  const [category, setCategory] = React.useState('');
  const [purchaseMonth, setPurchaseMonth] = React.useState('');
  const [sortAlpha, setSortAlpha] = React.useState(true);
  const [groupByCategory, setGroupByCategory] = React.useState(true);

  const activeTraveller = planView?.shoppingTraveller ?? null;
  const activeCategory = planView?.shoppingCategory ?? '__all__';
  const activeMonth = planView?.shoppingMonthFilter ?? null;

  const canEditItem = React.useCallback(
    (item: ShoppingItem) => canEditOwnedRecord(spContext, item.ownerEmail, role, item.traveller, members),
    [spContext, role, members]
  );

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

  React.useEffect(() => {
    if (category && !categories.some((c) => c.toLowerCase() === category.toLowerCase())) {
      setCategory('');
    }
  }, [categories, category]);

  const filtered = React.useMemo(() => {
    let rows = items;
    if (activeTraveller === '__unassigned__') {
      rows = rows.filter((i) => !(i.traveller || '').trim());
    } else if (activeTraveller) {
      rows = rows.filter((i) =>
        assigneeLabelsMatch(spContext, i.traveller || travellers[0], activeTraveller, members)
      );
    }
    if (activeCategory === '__uncategorised__') {
      rows = rows.filter((i) => !(i.category || '').trim());
    } else if (activeCategory !== '__all__') {
      rows = rows.filter((i) => i.category === activeCategory);
    }
    if (activeMonth === '__unscheduled__') {
      rows = rows.filter((i) => !(i.purchaseMonth || '').trim());
    } else if (activeMonth) {
      rows = rows.filter((i) => (i.purchaseMonth || '') === activeMonth);
    }
    const sorted = [...rows].sort((a, b) => {
      if (sortAlpha) return (a.itemName || '').localeCompare(b.itemName || '', undefined, { sensitivity: 'base' });
      return (a.purchaseMonth || '').localeCompare(b.purchaseMonth || '', undefined, { sensitivity: 'base' });
    });
    return sorted;
  }, [items, activeTraveller, activeCategory, activeMonth, travellers, spContext, members, sortAlpha]);

  const grouped = React.useMemo(() => {
    if (!groupByCategory) {
      return [{ key: 'all', label: 'All items', rows: filtered }];
    }
    const map = new Map<string, ShoppingItem[]>();
    for (const item of filtered) {
      const key = (item.category || 'Uncategorised').trim() || 'Uncategorised';
      const rows = map.get(key) ?? [];
      rows.push(item);
      map.set(key, rows);
    }
    return Array.from(map.entries())
      .sort((a, b) => a[0].localeCompare(b[0], undefined, { sensitivity: 'base' }))
      .map(([key, rows]) => ({ key, label: key, rows }));
  }, [filtered, groupByCategory]);

  const markPurchased = (item: ShoppingItem, purchased: boolean): void => {
    void (async () => {
      try {
        await service.update(item.id, { isPurchased: purchased });
        if (purchased && trip?.id) {
          await offerAddPurchasedShoppingToPacking(spContext, trip.id, item, members);
        }
        refresh();
      } catch (err) {
        // eslint-disable-next-line no-console
        console.error(err);
      }
    })();
  };

  const summary = React.useMemo(
    () => summarizeShoppingItems(items, activeTraveller, activeCategory, activeMonth, spContext, members),
    [items, activeTraveller, activeCategory, activeMonth, spContext, members]
  );

  const assignTraveller =
    activeTraveller && activeTraveller !== '__unassigned__'
      ? activeTraveller
      : travellers[0] || 'Traveller 1';
  const canAdd = (role === 'Editor' || role === 'Companion') && categories.length > 0;

  const addItem = (): void => {
    if (!trip?.id || !name.trim() || !category.trim()) return;
    rememberTripShoppingCategory(trip.id, category.trim());
    service
      .create({
        tripId: trip.id,
        itemName: name.trim(),
        category: category.trim(),
        traveller: assignTraveller,
        budgetAmount: 0,
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
        setPurchaseMonth('');
        setAddOpen(false);
        refresh();
      })
      .catch(console.error);
  };

  const categoryOptions = (itemCategory: string): string[] => categoriesForItemSelect(categories, itemCategory);

  return (
    <section className={styles.mobileListSection} aria-label="Shopping list">
      {!embedded ? (
        <div className={styles.mobileListHeader}>
          <div>
            <h2 className={styles.mobileListTitle}>Shopping</h2>
            <p className={styles.mobileListMeta}>
              {filtered.length} items
              {activeTraveller ? ` · ${activeTraveller}` : ''}
              {canSeeFinancials
                ? ` · Budget ${formatCurrency(summary.totals.budget, config.homeCurrency)}`
                : ''}
            </p>
          </div>
          {canAdd ? (
            <button type="button" className={styles.mobileFab} onClick={() => setAddOpen((v) => !v)}>
              {addOpen ? 'Close' : '+ Add'}
            </button>
          ) : null}
        </div>
      ) : canAdd ? (
        <div className={styles.mobileListHeader}>
          <span />
          <button type="button" className={styles.mobileFab} onClick={() => setAddOpen((v) => !v)}>
            {addOpen ? 'Close' : '+ Add item'}
          </button>
        </div>
      ) : null}
      <div className={styles.mobileListOptionsRow}>
        <button type="button" className={styles.pagerBtn} onClick={() => setSortAlpha((v) => !v)}>
          {sortAlpha ? 'A-Z' : 'Created'}
        </button>
        <button type="button" className={styles.pagerBtn} onClick={() => setGroupByCategory((v) => !v)}>
          {groupByCategory ? 'Grouped' : 'Flat list'}
        </button>
      </div>

      {categories.length === 0 ? (
        <p className={styles.muted}>Add a category in filters above before adding items.</p>
      ) : null}

      {addOpen ? (
        <div className={styles.mobileAddCard}>
          <input
            className={styles.mobileField}
            placeholder="Item to buy"
            value={name}
            onChange={(e) => setName(e.target.value)}
          />
          <select className={styles.mobileField} value={category} onChange={(e) => setCategory(e.target.value)}>
            <option value="">Category…</option>
            {categories.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>
          <input
            className={styles.mobileField}
            type="month"
            value={purchaseMonth}
            onChange={(e) => setPurchaseMonth(e.target.value)}
            aria-label="Purchase month"
          />
          <button
            type="button"
            className={styles.mobilePrimaryBtn}
            onClick={addItem}
            disabled={!name.trim() || !category.trim()}
          >
            Add item
          </button>
        </div>
      ) : null}

      {filtered.length === 0 ? (
        <p className={styles.muted}>No shopping items yet.</p>
      ) : (
        <div className={styles.mobileGroupedList}>
          {grouped.map((group) => (
            <section key={group.key} className={styles.mobileGroupBlock}>
              {groupByCategory ? <h3 className={styles.mobileGroupHeading}>{group.label}</h3> : null}
              <ul className={styles.mobileItemList}>
                {group.rows.map((item) => {
            const editable = canEditItem(item);
            const open = expandedId === item.id;
            return (
              <li
                key={item.id}
                className={`${styles.mobileListItem} ${item.isPurchased ? styles.mobileListItemDone : ''}`}
              >
                <div className={styles.mobileListItemMain}>
                  <input
                    type="checkbox"
                    checked={item.isPurchased}
                    disabled={!editable}
                    aria-label={`Purchased: ${item.itemName}`}
                    onChange={(e) => markPurchased(item, e.target.checked)}
                  />
                  <button
                    type="button"
                    className={styles.mobileListItemBtn}
                    onClick={() => setExpandedId(open ? null : item.id)}
                  >
                    <span className={styles.mobileListItemTitle}>{item.itemName}</span>
                    <span className={styles.mobileListItemSub}>
                      {item.category || 'Uncategorised'}
                      {item.traveller ? ` · ${item.traveller}` : ''}
                      {canSeeFinancials && item.budgetAmount
                        ? ` · ${formatCurrency(item.budgetAmount, config.homeCurrency)}`
                        : ''}
                    </span>
                  </button>
                  <span className={styles.mobileChevron} aria-hidden>
                    {open ? '▴' : '▾'}
                  </span>
                </div>
                {open ? (
                  <div className={styles.mobileListItemDetail}>
                    {editable ? (
                      <>
                        <select
                          className={styles.mobileField}
                          value={item.category || ''}
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
                          className={styles.mobileField}
                          value={item.traveller || travellers[0]}
                          onChange={(e) =>
                            service
                              .update(item.id, {
                                traveller: e.target.value,
                                ownerEmail: resolveOwnerEmailForAssignee(spContext, e.target.value, members)
                              })
                              .then(refresh)
                              .catch(console.error)
                          }
                        >
                          {travellers.map((t) => (
                            <option key={t} value={t}>
                              {t}
                            </option>
                          ))}
                        </select>
                        <input
                          className={styles.mobileField}
                          type="month"
                          value={item.purchaseMonth || ''}
                          onChange={(e) =>
                            service.update(item.id, { purchaseMonth: e.target.value }).then(refresh).catch(console.error)
                          }
                        />
                        <input
                          className={styles.mobileField}
                          placeholder="Website URL"
                          defaultValue={item.websiteUrl}
                          onBlur={(e) => {
                            const v = e.target.value.trim();
                            if (v !== (item.websiteUrl || '')) {
                              service.update(item.id, { websiteUrl: v }).then(refresh).catch(console.error);
                            }
                          }}
                        />
                        <textarea
                          className={styles.mobileField}
                          placeholder="Notes"
                          defaultValue={item.notes}
                          onBlur={(e) => {
                            const v = e.target.value.trim();
                            if (v !== (item.notes || '')) {
                              service.update(item.id, { notes: v }).then(refresh).catch(console.error);
                            }
                          }}
                        />
                        <button
                          type="button"
                          className={styles.mobileDangerBtn}
                          onClick={() => {
                            void (async () => {
                              if (!(await confirmUserAction('Delete this shopping item?'))) return;
                              service.delete(item.id).then(refresh).catch(console.error);
                            })();
                          }}
                        >
                          Delete
                        </button>
                      </>
                    ) : (
                      <>
                        {item.websiteUrl ? (
                          <a className={styles.linkBtn} href={item.websiteUrl} target="_blank" rel="noopener noreferrer">
                            Open link
                          </a>
                        ) : null}
                        {item.notes?.trim() ? <p className={styles.muted}>{item.notes}</p> : null}
                      </>
                    )}
                  </div>
                ) : null}
              </li>
            );
                })}
              </ul>
            </section>
          ))}
        </div>
      )}
    </section>
  );
};
