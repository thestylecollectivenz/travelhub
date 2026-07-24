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
import { TravellerAvatar } from '../shared/TravellerAvatar';
import { useShellMode } from '../../hooks/useShellMode';
import { MobilePackingFilters } from './MobilePackingFilters';
import { PackingCategoryIcon } from './packingCategoryIcon';
import chrome from './MobileTabChrome.module.css';
import styles from './MobilePackingList.module.css';

type PackedStatusFilter = 'all' | 'packed' | 'unpacked';
type ViewMode = 'az' | 'grouped';

function memberForName(
  name: string,
  members: ReturnType<typeof useTripMembers>['members']
): { displayName: string; avatarUrl?: string } {
  const n = name.trim().toLowerCase();
  const hit = members.find(
    (m) =>
      (m.userDisplayName || '').trim().toLowerCase() === n ||
      (m.userEmail || '').trim().toLowerCase() === n
  );
  return {
    displayName: hit?.userDisplayName || name,
    avatarUrl: hit?.avatarUrl
  };
}

function EditPencilIcon(): React.ReactElement {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden>
      <path
        d="M4 20h4l10.5-10.5a2.1 2.1 0 0 0-3-3L5 17v3Z"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinejoin="round"
      />
      <path d="M13 6.5 17.5 11" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
    </svg>
  );
}

export const MobilePackingList: React.FC<{ embedded?: boolean }> = ({ embedded = false }) => {
  const spContext = useSpContext();
  const { trip } = useTripWorkspace();
  const planView = usePlanView();
  const activeCategory = planView?.packingCategory ?? '__all__';
  const activeTraveller = planView?.packingTraveller ?? null;
  const { role } = useTripRole();
  const { members, travellers } = useTripMembers(trip?.id);
  const { categories } = useTripShoppingCategories(trip?.id, spContext);
  useCompanionListDefaults(planView, role, members);
  const shellMode = useShellMode();
  const isIpad = shellMode === 'ipad-portrait';
  const service = React.useMemo(() => new PackingService(spContext), [spContext]);
  const [items, setItems] = React.useState<PackingItem[]>([]);
  const [addOpen, setAddOpen] = React.useState(false);
  const [filtersOpen, setFiltersOpen] = React.useState(false);
  const [expandedId, setExpandedId] = React.useState<string | null>(null);
  const [search, setSearch] = React.useState('');
  const [packedFilter, setPackedFilter] = React.useState<PackedStatusFilter>('all');
  const [viewMode, setViewMode] = React.useState<ViewMode>('az');
  const [name, setName] = React.useState('');
  const [qty, setQty] = React.useState(1);
  const [addCategory, setAddCategory] = React.useState('Other');

  React.useEffect(() => {
    const handler = (): void => setAddOpen(true);
    window.addEventListener(MOBILE_OPEN_PACKING_ADD, handler);
    return () => window.removeEventListener(MOBILE_OPEN_PACKING_ADD, handler);
  }, []);

  React.useEffect(() => {
    if (categories.length && !categories.some((c) => c.toLowerCase() === addCategory.toLowerCase())) {
      setAddCategory(categories.find((c) => c.toLowerCase() === 'other') || categories[0]);
    }
  }, [categories, addCategory]);

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
    if (packedFilter === 'packed') rows = rows.filter((i) => i.isPacked);
    if (packedFilter === 'unpacked') rows = rows.filter((i) => !i.isPacked);
    const q = search.trim().toLowerCase();
    if (q) {
      rows = rows.filter((i) =>
        [i.itemName, i.category, i.itemNotes, i.traveller]
          .filter(Boolean)
          .join(' ')
          .toLowerCase()
          .includes(q)
      );
    }
    rows = [...rows].sort((a, b) => {
      if (viewMode === 'az') {
        return (a.itemName || '').localeCompare(b.itemName || '', undefined, { sensitivity: 'base' });
      }
      const cat = (a.category || '').localeCompare(b.category || '', undefined, { sensitivity: 'base' });
      if (cat !== 0) return cat;
      return (a.itemName || '').localeCompare(b.itemName || '', undefined, { sensitivity: 'base' });
    });
    return rows;
  }, [
    items,
    activeTraveller,
    activeCategory,
    travellers,
    spContext,
    members,
    packedFilter,
    search,
    viewMode
  ]);

  const grouped = React.useMemo(() => {
    if (viewMode !== 'grouped') return [{ key: 'all', label: 'All items', rows: filtered }];
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
  }, [filtered, viewMode]);

  const canAdd = role === 'Editor' || role === 'Companion';

  const addItem = (): void => {
    if (!trip?.id || !name.trim()) return;
    const traveller = activeTraveller || travellers[0] || 'Traveller 1';
    const fallback = categories.find((c) => c.toLowerCase() === 'other') || categories[0] || 'Other';
    const itemCategory =
      activeCategory !== '__all__'
        ? activeCategory
        : categories.some((c) => c.toLowerCase() === addCategory.toLowerCase())
          ? addCategory
          : fallback;
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

  const bumpQty = (item: PackingItem, delta: number): void => {
    if (!canEditItem(item)) return;
    const next = Math.max(1, (item.quantity || 1) + delta);
    if (next === item.quantity) return;
    service.update(item.id, { quantity: next }).then(refresh).catch(console.error);
  };

  const renderRow = (item: PackingItem): React.ReactNode => {
    const editable = canEditItem(item);
    const open = expandedId === item.id;
    const who = memberForName(item.traveller || travellers[0] || 'Traveller', members);
    const cat = (item.category || 'Other').trim() || 'Other';

    return (
      <li
        key={item.id}
        className={`${styles.row} ${item.isPacked ? styles.rowPacked : ''} ${open ? styles.rowOpen : ''}`.trim()}
      >
        <div className={styles.rowMain}>
          <label className={styles.checkWrap}>
            <input
              type="checkbox"
              className={styles.check}
              checked={item.isPacked}
              disabled={!editable}
              aria-label={`Packed: ${item.itemName}`}
              onChange={(e) =>
                service.update(item.id, { isPacked: e.target.checked }).then(refresh).catch(console.error)
              }
            />
          </label>

          <span className={styles.catIcon} aria-hidden>
            <PackingCategoryIcon category={cat} size={isIpad ? 18 : 16} />
          </span>

          <div className={styles.itemCell}>
            <span className={styles.itemName}>{item.itemName}</span>
            <span className={styles.itemCat}>{cat}</span>
          </div>

          <div className={styles.qtyCell} aria-label={`Quantity ${item.quantity}`}>
            {isIpad && editable ? (
              <div className={styles.qtyStepper}>
                <button type="button" className={styles.qtyBtn} onClick={() => bumpQty(item, -1)} aria-label="Decrease">
                  −
                </button>
                <span className={styles.qtyValue}>{item.quantity}</span>
                <button type="button" className={styles.qtyBtn} onClick={() => bumpQty(item, 1)} aria-label="Increase">
                  +
                </button>
              </div>
            ) : (
              <span className={styles.qtyValue}>{item.quantity}</span>
            )}
          </div>

          <div className={styles.forCell}>
            <TravellerAvatar displayName={who.displayName} avatarUrl={who.avatarUrl} size={isIpad ? 26 : 22} />
            <span className={styles.forName}>{who.displayName.split(/\s+/)[0] || who.displayName}</span>
          </div>

          <div className={styles.notesCell}>
            <span className={styles.notesText}>{item.itemNotes?.trim() || '—'}</span>
          </div>

          <button
            type="button"
            className={styles.editBtn}
            aria-label={open ? 'Close edit' : `Edit ${item.itemName}`}
            aria-expanded={open}
            onClick={() => setExpandedId(open ? null : item.id)}
          >
            <EditPencilIcon />
          </button>
        </div>

        {open ? (
          <div className={styles.detail}>
            {editable ? (
              <>
                <label className={styles.fieldLabel}>
                  Item
                  <input
                    className={styles.field}
                    defaultValue={item.itemName}
                    onBlur={(e) => {
                      const v = e.target.value.trim();
                      if (v && v !== item.itemName) {
                        service.update(item.id, { itemName: v }).then(refresh).catch(console.error);
                      }
                    }}
                  />
                </label>
                <div className={styles.detailRow}>
                  <label className={styles.fieldLabel}>
                    Qty
                    <input
                      className={styles.fieldQty}
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
                  </label>
                  <label className={styles.fieldLabel}>
                    Category
                    <select
                      className={styles.field}
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
                  </label>
                </div>
                <label className={styles.fieldLabel}>
                  For
                  <select
                    className={styles.field}
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
                </label>
                <label className={styles.fieldLabel}>
                  Notes
                  <textarea
                    className={styles.field}
                    rows={2}
                    placeholder="Notes"
                    defaultValue={item.itemNotes ?? ''}
                    onBlur={(e) => {
                      const v = e.target.value.trim();
                      if (v !== (item.itemNotes || '')) {
                        service.update(item.id, { itemNotes: v }).then(refresh).catch(console.error);
                      }
                    }}
                  />
                </label>
                <button
                  type="button"
                  className={styles.deleteBtn}
                  onClick={() => {
                    service.delete(item.id).then(refresh).catch(console.error);
                  }}
                >
                  Delete
                </button>
              </>
            ) : (
              <p className={styles.readOnlyHint}>You can view this item but only the owner or an editor can change it.</p>
            )}
          </div>
        ) : null}
      </li>
    );
  };

  return (
    <section
      className={styles.page}
      data-shell={isIpad ? 'ipad-portrait' : undefined}
      aria-label="Packing list"
    >
      {!embedded ? <h2 className={styles.standaloneTitle}>Packing</h2> : null}

      <div className={styles.toolbar}>
        <input
          className={styles.search}
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search packing list…"
          aria-label="Search packing list"
        />
        <button
          type="button"
          className={filtersOpen ? styles.filterBtnOn : styles.filterBtn}
          aria-expanded={filtersOpen}
          onClick={() => setFiltersOpen((v) => !v)}
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" aria-hidden>
            <path d="M4 6h16M7 12h10M10 18h4" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
          </svg>
          Filters
        </button>
        {canAdd ? (
          <button type="button" className={styles.addBtn} onClick={() => setAddOpen((v) => !v)}>
            {addOpen ? 'Close' : '+ Add item'}
          </button>
        ) : null}
      </div>

      {filtersOpen ? (
        <MobilePackingFilters
          travellers={travellers}
          hideTravellers
          packedFilter={packedFilter}
          onPackedFilterChange={setPackedFilter}
        />
      ) : null}

      <div className={styles.travellerRow}>
        <span className={styles.travellerLabel}>Filter by traveller</span>
        <div className={styles.travellerChips} role="group" aria-label="Filter by traveller">
          <button
            type="button"
            className={`${styles.travChip} ${activeTraveller === null ? styles.travChipOn : ''}`}
            onClick={() => planView?.setPackingTraveller(null)}
          >
            All
          </button>
          {travellers.map((t) => {
            const who = memberForName(t, members);
            return (
              <button
                key={t}
                type="button"
                className={`${styles.travChip} ${activeTraveller === t ? styles.travChipOn : ''}`}
                onClick={() => planView?.setPackingTraveller(t)}
              >
                <TravellerAvatar displayName={who.displayName} avatarUrl={who.avatarUrl} size={20} />
                <span>{who.displayName.split(/\s+/)[0] || who.displayName}</span>
              </button>
            );
          })}
        </div>
        {activeTraveller ? (
          <button type="button" className={styles.clearTrav} onClick={() => planView?.setPackingTraveller(null)}>
            Clear
          </button>
        ) : null}
      </div>

      <div className={styles.viewRow}>
        <div className={styles.viewToggle} role="group" aria-label="List view">
          <button
            type="button"
            className={`${styles.viewBtn} ${viewMode === 'az' ? styles.viewBtnOn : ''}`}
            onClick={() => setViewMode('az')}
          >
            A–Z
          </button>
          <button
            type="button"
            className={`${styles.viewBtn} ${viewMode === 'grouped' ? styles.viewBtnOn : ''}`}
            onClick={() => setViewMode('grouped')}
          >
            Grouped
          </button>
        </div>
        <span className={styles.itemCount}>
          {filtered.length} item{filtered.length === 1 ? '' : 's'}
        </span>
      </div>

      {addOpen ? (
        <div className={styles.addCard}>
          <input
            className={styles.field}
            placeholder="Item name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            aria-label="New item name"
          />
          <div className={styles.detailRow}>
            <select
              className={styles.field}
              value={activeCategory !== '__all__' ? activeCategory : addCategory}
              onChange={(e) => {
                setAddCategory(e.target.value);
                if (activeCategory !== '__all__') planView?.setPackingCategory(e.target.value);
              }}
              aria-label="Category"
            >
              {(activeCategory !== '__all__' ? categoryOptions(activeCategory) : categories).map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>
            <input
              className={styles.fieldQty}
              type="number"
              min={1}
              value={qty}
              onChange={(e) => setQty(Math.max(1, Number(e.target.value) || 1))}
              aria-label="Quantity"
            />
          </div>
          <button type="button" className={styles.saveAddBtn} onClick={addItem} disabled={!name.trim()}>
            Add item
          </button>
        </div>
      ) : null}

      {filtered.length === 0 ? (
        <p className={chrome.muted}>No packing items match these filters.</p>
      ) : (
        <div className={styles.tableWrap}>
          <div className={`${styles.tableHead} ${styles.rowMain}`} aria-hidden={!isIpad}>
            <span className={styles.checkWrap} />
            <span className={styles.catIcon} />
            <span className={styles.itemCell}>Item</span>
            <span className={styles.qtyCell}>Qty</span>
            <span className={styles.forCell}>For</span>
            <span className={styles.notesCell}>Notes</span>
            <span className={styles.editBtn} />
          </div>
          {grouped.map((group) => (
            <section key={group.key} className={styles.group}>
              {viewMode === 'grouped' ? (
                <h3 className={styles.groupHeading}>
                  <span className={styles.catIcon} aria-hidden>
                    <PackingCategoryIcon category={group.label} size={16} />
                  </span>
                  {group.label}
                  <span className={styles.groupMeta}>
                    {group.rows.filter((r) => r.isPacked).length}/{group.rows.length} packed
                  </span>
                </h3>
              ) : null}
              <ul className={styles.list}>{group.rows.map((item) => renderRow(item))}</ul>
            </section>
          ))}
        </div>
      )}
    </section>
  );
};
