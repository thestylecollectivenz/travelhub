import * as React from 'react';
import { usePlanView } from '../../context/PlanViewContext';
import { useTripWorkspace } from '../../context/TripWorkspaceContext';
import { useSpContext } from '../../context/SpContext';
import { PackingItem, PackingService } from '../../services/PackingService';
import { useTripRole } from '../../context/TripRoleContext';
import { canEditOwnedRecord } from '../../utils/canEditOwnedRecord';
import { useTripMembers } from '../../hooks/useTripMembers';
import { useCompanionListDefaults } from '../../hooks/useCompanionListDefaults';
import { assigneeLabelsMatch, resolveOwnerEmailForAssignee } from '../../utils/tripMemberIdentity';
import { MOBILE_OPEN_PACKING_ADD } from '../../utils/mobileHomePendingAction';
import { useTripShoppingCategories } from '../../hooks/useTripShoppingCategories';
import { categoriesForItemSelect, rememberTripShoppingCategory } from '../../utils/tripShoppingCategories';
import styles from './MobileShell.module.css';

export const MobilePackingList: React.FC<{ embedded?: boolean }> = ({ embedded = false }) => {
  const spContext = useSpContext();
  const { trip } = useTripWorkspace();
  const planView = usePlanView();
  const activeCategory = planView?.packingCategory ?? 'Other';
  const activeTraveller = planView?.packingTraveller ?? null;
  const { role } = useTripRole();
  const { members, travellers } = useTripMembers(trip?.id);
  const { categories } = useTripShoppingCategories(trip?.id, spContext);
  useCompanionListDefaults(planView, role, members);
  const service = React.useMemo(() => new PackingService(spContext), [spContext]);
  const [items, setItems] = React.useState<PackingItem[]>([]);
  const [addOpen, setAddOpen] = React.useState(false);
  const [expandedId, setExpandedId] = React.useState<string | null>(null);
  const [name, setName] = React.useState('');
  const [qty, setQty] = React.useState(1);
  const [sortAlpha, setSortAlpha] = React.useState(true);
  const [groupByCategory, setGroupByCategory] = React.useState(true);

  React.useEffect(() => {
    const handler = (): void => setAddOpen(true);
    window.addEventListener(MOBILE_OPEN_PACKING_ADD, handler);
    return () => window.removeEventListener(MOBILE_OPEN_PACKING_ADD, handler);
  }, []);

  const canEditItem = React.useCallback(
    (item: PackingItem) => canEditOwnedRecord(spContext, item.ownerEmail, role, item.traveller, members),
    [spContext, role, members]
  );

  const refresh = React.useCallback(() => {
    if (!trip?.id) return;
    service.getForTrip(trip.id).then(setItems).catch(console.error);
  }, [service, trip?.id]);

  React.useEffect(() => {
    refresh();
  }, [refresh]);

  const filtered = React.useMemo(() => {
    let rows = items;
    if (activeTraveller) {
      rows = rows.filter((i) =>
        assigneeLabelsMatch(spContext, i.traveller || travellers[0] || '', activeTraveller, members)
      );
    }
    if (activeCategory !== '__all__') {
      rows = rows.filter((i) => {
        const cat = (i.category || '').trim() || 'Other';
        return cat.toLowerCase() === activeCategory.trim().toLowerCase();
      });
    }
    rows = [...rows].sort((a, b) =>
      sortAlpha
        ? (a.itemName || '').localeCompare(b.itemName || '', undefined, { sensitivity: 'base' })
        : (a.category || '').localeCompare(b.category || '', undefined, { sensitivity: 'base' })
    );
    return rows;
  }, [items, activeTraveller, activeCategory, travellers, spContext, members, sortAlpha]);

  const grouped = React.useMemo(() => {
    if (!groupByCategory) return [{ key: 'all', label: 'All items', rows: filtered }];
    const map = new Map<string, PackingItem[]>();
    for (const item of filtered) {
      const key = (item.category || 'Other').trim() || 'Other';
      const rows = map.get(key) ?? [];
      rows.push(item);
      map.set(key, rows);
    }
    return Array.from(map.entries())
      .sort((a, b) => a[0].localeCompare(b[0], undefined, { sensitivity: 'base' }))
      .map(([key, rows]) => ({ key, label: key, rows }));
  }, [filtered, groupByCategory]);

  const packedCount = filtered.filter((i) => i.isPacked).length;
  const canAdd = role === 'Editor' || role === 'Companion';

  const addItem = (): void => {
    if (!trip?.id || !name.trim()) return;
    const traveller = activeTraveller || travellers[0] || 'Traveller 1';
    const fallback =
      categories.find((c) => c.toLowerCase() === 'other') || categories[0] || 'Other';
    const itemCategory =
      activeCategory === '__all__'
        ? categories.some((c) => c.toLowerCase() === (planView?.packingCategory ?? '').toLowerCase())
          ? (planView?.packingCategory as string)
          : fallback
        : activeCategory;
    rememberTripShoppingCategory(trip.id, itemCategory);
    service
      .create({
        tripId: trip.id,
        category: itemCategory,
        traveller,
        itemName: name.trim(),
        quantity: qty,
        isPacked: false,
        isTemplate: false,
        templateId: '',
        ownerEmail: resolveOwnerEmailForAssignee(spContext, traveller, members)
      })
      .then(() => {
        setName('');
        setQty(1);
        setAddOpen(false);
        refresh();
      })
      .catch(console.error);
  };

  const categoryOptions = (itemCategory: string): string[] => categoriesForItemSelect(categories, itemCategory);

  return (
    <section className={styles.mobileListSection} aria-label="Packing list">
      {!embedded ? (
        <div className={styles.mobileListHeader}>
          <div>
            <h2 className={styles.mobileListTitle}>Packing</h2>
            <p className={styles.mobileListMeta}>
              {packedCount} of {filtered.length} packed
              {activeTraveller ? ` · ${activeTraveller}` : ''}
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
          {sortAlpha ? 'A-Z' : 'By category'}
        </button>
        <button type="button" className={styles.pagerBtn} onClick={() => setGroupByCategory((v) => !v)}>
          {groupByCategory ? 'Grouped' : 'Flat list'}
        </button>
      </div>

      {addOpen ? (
        <div className={styles.mobileAddCard}>
          <input
            className={styles.mobileField}
            placeholder="Item name"
            value={name}
            onChange={(e) => setName(e.target.value)}
          />
          <div className={styles.mobileAddRow}>
            <select
              className={styles.mobileField}
              value={
                activeCategory === '__all__'
                  ? categories.some((c) => c === planView?.packingCategory)
                    ? (planView?.packingCategory as string)
                    : categories[0] || 'Other'
                  : activeCategory
              }
              onChange={(e) => planView?.setPackingCategory(e.target.value)}
            >
              {(activeCategory === '__all__' ? categories : categoryOptions(activeCategory)).map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>
            <input
              className={styles.mobileFieldQty}
              type="number"
              min={1}
              value={qty}
              onChange={(e) => setQty(Math.max(1, Number(e.target.value) || 1))}
              aria-label="Quantity"
            />
          </div>
          <button type="button" className={styles.mobilePrimaryBtn} onClick={addItem} disabled={!name.trim()}>
            Add item
          </button>
        </div>
      ) : null}

      {filtered.length === 0 ? (
        <p className={styles.muted}>No packing items yet.</p>
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
              <li key={item.id} className={`${styles.mobileListItem} ${item.isPacked ? styles.mobileListItemDone : ''}`}>
                <div className={styles.mobileListItemMain}>
                  <input
                    type="checkbox"
                    checked={item.isPacked}
                    disabled={!editable}
                    aria-label={`Packed: ${item.itemName}`}
                    onChange={(e) =>
                      service.update(item.id, { isPacked: e.target.checked }).then(refresh).catch(console.error)
                    }
                  />
                  <button
                    type="button"
                    className={styles.mobileListItemBtn}
                    onClick={() => setExpandedId(open ? null : item.id)}
                  >
                    <span className={styles.mobileListItemTitle}>{item.itemName}</span>
                    <span className={styles.mobileListItemSub}>
                      {item.category}
                      {item.quantity > 1 ? ` · ×${item.quantity}` : ''}
                      {item.traveller ? ` · ${item.traveller}` : ''}
                    </span>
                  </button>
                  <span className={styles.mobileChevron} aria-hidden>
                    {open ? '▴' : '▾'}
                  </span>
                </div>
                {open ? (
                  <div className={styles.mobileListItemDetail}>
                    {item.itemNotes?.trim() ? <p className={styles.muted}>{item.itemNotes}</p> : null}
                    {editable ? (
                      <>
                        <input
                          className={styles.mobileField}
                          defaultValue={item.itemName}
                          onBlur={(e) => {
                            const v = e.target.value.trim();
                            if (v && v !== item.itemName) {
                              service.update(item.id, { itemName: v }).then(refresh).catch(console.error);
                            }
                          }}
                        />
                        <div className={styles.mobileAddRow}>
                          <input
                            className={styles.mobileFieldQty}
                            type="number"
                            min={1}
                            defaultValue={item.quantity}
                            onBlur={(e) => {
                              const v = Math.max(1, Number(e.target.value) || 1);
                              if (v !== item.quantity) {
                                service.update(item.id, { quantity: v }).then(refresh).catch(console.error);
                              }
                            }}
                          />
                          <select
                            className={styles.mobileField}
                            value={item.category || 'Other'}
                            onChange={(e) => {
                              if (trip?.id) rememberTripShoppingCategory(trip.id, e.target.value);
                              service.update(item.id, { category: e.target.value }).then(refresh).catch(console.error);
                            }}
                          >
                            {categoryOptions(item.category).map((c) => (
                              <option key={c} value={c}>
                                {c}
                              </option>
                            ))}
                          </select>
                        </div>
                        <select
                          className={styles.mobileField}
                          value={item.traveller || travellers[0] || ''}
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
                        <textarea
                          className={styles.mobileField}
                          placeholder="Notes"
                          defaultValue={item.itemNotes ?? ''}
                          onBlur={(e) => {
                            const v = e.target.value.trim();
                            if (v !== (item.itemNotes || '')) {
                              service.update(item.id, { itemNotes: v }).then(refresh).catch(console.error);
                            }
                          }}
                        />
                        <button
                          type="button"
                          className={styles.mobileDangerBtn}
                          onClick={() => {
                            service.delete(item.id).then(refresh).catch(console.error);
                          }}
                        >
                          Delete
                        </button>
                      </>
                    ) : null}
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
