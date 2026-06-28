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
import styles from './MobileShell.module.css';

const CATEGORIES = ['Clothing', 'Shoes', 'Accessories', 'Toiletries', 'Electronics', 'Documents', 'Medications', 'Other'];

export const MobilePackingList: React.FC = () => {
  const spContext = useSpContext();
  const { trip } = useTripWorkspace();
  const planView = usePlanView();
  const activeCategory = planView?.packingCategory ?? 'Other';
  const activeTraveller = planView?.packingTraveller ?? null;
  const { role } = useTripRole();
  const { members, travellers } = useTripMembers(trip?.id);
  useCompanionListDefaults(planView, role, members);
  const service = React.useMemo(() => new PackingService(spContext), [spContext]);
  const [items, setItems] = React.useState<PackingItem[]>([]);
  const [addOpen, setAddOpen] = React.useState(false);
  const [expandedId, setExpandedId] = React.useState<string | null>(null);
  const [name, setName] = React.useState('');
  const [qty, setQty] = React.useState(1);

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
      rows = rows.filter(
        (i) => (CATEGORIES.indexOf(i.category) >= 0 ? i.category : 'Other') === activeCategory
      );
    }
    return rows;
  }, [items, activeTraveller, activeCategory, travellers, spContext, members]);

  const packedCount = filtered.filter((i) => i.isPacked).length;
  const canAdd = role === 'Editor' || role === 'Companion';

  const addItem = (): void => {
    if (!trip?.id || !name.trim()) return;
    const traveller = activeTraveller || travellers[0] || 'Traveller 1';
    const itemCategory =
      activeCategory === '__all__'
        ? CATEGORIES.indexOf(planView?.packingCategory ?? '') >= 0
          ? (planView?.packingCategory as string)
          : 'Other'
        : activeCategory;
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

  return (
    <section className={styles.mobileListSection} aria-label="Packing list">
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
              value={activeCategory === '__all__' ? (planView?.packingCategory ?? 'Other') : activeCategory}
              onChange={(e) => planView?.setPackingCategory(e.target.value)}
            >
              {activeCategory === '__all__' ? (
                CATEGORIES.map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))
              ) : (
                <option value={activeCategory}>{activeCategory}</option>
              )}
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
        <ul className={styles.mobileItemList}>
          {filtered.map((item) => {
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
                    ) : null}
                  </div>
                ) : null}
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
};
