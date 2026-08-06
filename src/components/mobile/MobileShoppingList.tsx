import * as React from 'react';
import { usePlanView } from '../../context/PlanViewContext';
import { useTripWorkspace } from '../../context/TripWorkspaceContext';
import { useSpContext } from '../../context/SpContext';
import { useConfig } from '../../context/ConfigContext';
import { ShoppingItem, ShoppingListService } from '../../services/ShoppingListService';
import { formatCurrency } from '../../utils/financialUtils';
import {
  categoriesForItemSelect,
  notifyShoppingItemsChanged,
  rememberTripShoppingCategory
} from '../../utils/tripShoppingCategories';
import { useTripShoppingCategories } from '../../hooks/useTripShoppingCategories';
import { confirmUserAction } from '../../utils/confirmAction';
import { addShoppingItemToPacking, offerAddPurchasedShoppingToPacking } from '../../utils/shoppingToPacking';
import { useTripRole } from '../../context/TripRoleContext';
import { canEditOwnedRecord } from '../../utils/canEditOwnedRecord';
import { useCanSeeFinancials } from '../../hooks/useCanSeeFinancials';
import { useTripMembers } from '../../hooks/useTripMembers';
import { useCompanionListDefaults } from '../../hooks/useCompanionListDefaults';
import { assigneeLabelsMatch, resolveOwnerEmailForAssignee, travellerLabelForCurrentUser } from '../../utils/tripMemberIdentity';
import { flashToast } from '../../utils/flashToast';
import { MOBILE_OPEN_SHOPPING_ADD } from '../../utils/mobileHomePendingAction';
import { TravellerAvatar } from '../shared/TravellerAvatar';
import { useShellMode } from '../../hooks/useShellMode';
import {
  MobileShoppingFilters,
  monthLabel,
  ShoppingFilterDraft,
  shoppingItemStatus
} from './MobileShoppingFilters';
import { PackingCategoryIcon } from './packingCategoryIcon';
import { isAllSelected } from '../../utils/multiSelectFilters';
import { matchesShoppingCategories, matchesShoppingMonths } from '../../utils/shoppingSummary';
import chrome from './MobileTabChrome.module.css';
import styles from './MobileShoppingList.module.css';
import { useOfflineStatus } from '../../context/OfflineStatusContext';
import { loadTripOfflineCache, patchTripOfflineExtrasCache } from '../../utils/tripOfflineCache';
import { isLikelyNetworkError } from '../../utils/networkError';

type ViewMode = 'az' | 'grouped';

const NO_FILTERS: string[] = [];

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

function DeleteIcon(): React.ReactElement {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" aria-hidden>
      <path d="M6 6l12 12M18 6 6 18" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
    </svg>
  );
}

function DetailsIcon(): React.ReactElement {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" aria-hidden>
      <path d="M7 3.5h7.5L19 8v12.5H7V3.5Z" stroke="currentColor" strokeWidth="1.6" strokeLinejoin="round" />
      <path d="M14 3.5V8h5" stroke="currentColor" strokeWidth="1.6" strokeLinejoin="round" />
      <path d="M9.5 12h5M9.5 15.5h5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
    </svg>
  );
}

export const MobileShoppingList: React.FC<{ embedded?: boolean }> = ({ embedded = false }) => {
  const spContext = useSpContext();
  const { reportNetworkFailure, warnIfOffline } = useOfflineStatus();
  const { trip } = useTripWorkspace();
  const { config, journalAuthorName } = useConfig();
  const planView = usePlanView();
  const activeCategories = planView?.shoppingCategories ?? NO_FILTERS;
  const activeTraveller = planView?.shoppingTraveller ?? null;
  const activeMonths = planView?.shoppingMonthFilters ?? NO_FILTERS;
  const statusFilter = planView?.shoppingStatusFilter ?? 'all';
  const hasNotesOnly = planView?.shoppingHasNotesOnly ?? false;
  const { role } = useTripRole();
  const { members, travellers } = useTripMembers(trip?.id);
  const { categories } = useTripShoppingCategories(trip?.id, spContext);
  useCompanionListDefaults(planView, role, members);
  const canSeeFinancials = useCanSeeFinancials();
  const shellMode = useShellMode();
  const isIpad = shellMode === 'ipad-portrait';
  const service = React.useMemo(() => new ShoppingListService(spContext), [spContext]);
  const [items, setItems] = React.useState<ShoppingItem[]>([]);
  const [addOpen, setAddOpen] = React.useState(false);
  const [adding, setAdding] = React.useState(false);
  const [filtersOpen, setFiltersOpen] = React.useState(false);
  const [search, setSearch] = React.useState('');
  const [viewMode, setViewMode] = React.useState<ViewMode>('az');
  const [name, setName] = React.useState('');
  const [addCategory, setAddCategory] = React.useState('Other');
  const [addTraveller, setAddTraveller] = React.useState('');
  const [addMonth, setAddMonth] = React.useState('');
  const [addPrice, setAddPrice] = React.useState('');
  const [noteDrafts, setNoteDrafts] = React.useState<Record<string, string>>({});
  const [urlDrafts, setUrlDrafts] = React.useState<Record<string, string>>({});
  const [notesOpenId, setNotesOpenId] = React.useState<string | null>(null);
  const addNameRef = React.useRef<HTMLInputElement | null>(null);
  const defaultTraveller = React.useMemo(
    () => travellerLabelForCurrentUser(spContext, members, journalAuthorName) || travellers[0] || '',
    [spContext, members, journalAuthorName, travellers]
  );

  React.useEffect(() => {
    const handler = (): void => {
      setAddOpen(true);
      window.setTimeout(() => addNameRef.current?.focus(), 50);
    };
    window.addEventListener(MOBILE_OPEN_SHOPPING_ADD, handler);
    return () => window.removeEventListener(MOBILE_OPEN_SHOPPING_ADD, handler);
  }, []);

  React.useEffect(() => {
    if (categories.length && !categories.some((c) => c.toLowerCase() === addCategory.toLowerCase())) {
      setAddCategory(categories.find((c) => c.toLowerCase() === 'other') || categories[0]);
    }
  }, [categories, addCategory]);

  React.useEffect(() => {
    if (!addTraveller && defaultTraveller) setAddTraveller(defaultTraveller);
  }, [defaultTraveller, addTraveller]);

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
        void patchTripOfflineExtrasCache(trip.id, { shoppingItems: rows });
      })
      .catch(async (err) => {
        console.error(err);
        if (isLikelyNetworkError(err)) reportNetworkFailure(err);
        const cached = await loadTripOfflineCache(trip.id);
        if (cached?.shoppingItems) setItems(cached.shoppingItems);
      });
  }, [service, trip?.id, reportNetworkFailure]);

  React.useEffect(() => {
    refresh();
  }, [refresh]);

  React.useEffect(() => {
    setNoteDrafts((prev) => {
      const next: Record<string, string> = {};
      for (const item of items) {
        next[item.id] = prev[item.id] !== undefined ? prev[item.id] : item.notes ?? '';
      }
      return next;
    });
    setUrlDrafts((prev) => {
      const next: Record<string, string> = {};
      for (const item of items) {
        next[item.id] = prev[item.id] !== undefined ? prev[item.id] : item.websiteUrl ?? '';
      }
      return next;
    });
  }, [items]);

  const filtered = React.useMemo(() => {
    let rows = items;
    if (activeTraveller === '__unassigned__') {
      rows = rows.filter((i) => !(i.traveller || '').trim());
    } else if (activeTraveller) {
      rows = rows.filter((i) =>
        assigneeLabelsMatch(spContext, i.traveller || travellers[0] || '', activeTraveller, members)
      );
    }
    rows = rows.filter((i) => matchesShoppingCategories(i.category, activeCategories));
    rows = rows.filter((i) => matchesShoppingMonths(i.purchaseMonth, activeMonths));
    if (statusFilter !== 'all') {
      rows = rows.filter((i) => shoppingItemStatus(i) === statusFilter);
    }
    if (hasNotesOnly) rows = rows.filter((i) => !!(i.notes || '').trim());
    const q = search.trim().toLowerCase();
    if (q) {
      rows = rows.filter((i) =>
        [i.itemName, i.category, i.notes, i.traveller, i.websiteUrl]
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
    activeCategories,
    activeMonths,
    statusFilter,
    hasNotesOnly,
    travellers,
    spContext,
    members,
    search,
    viewMode
  ]);

  const grouped = React.useMemo(() => {
    if (viewMode !== 'grouped') return [{ key: 'all', label: 'All items', rows: filtered }];
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
  }, [filtered, viewMode]);

  const canAdd = role === 'Editor' || role === 'Companion';
  const filtersActive =
    !isAllSelected(activeCategories) || activeMonths.length > 0 || statusFilter !== 'all' || hasNotesOnly;

  const monthPriceRollup = React.useMemo(() => {
    const map = new Map<string, { total: number; currency: string }>();
    for (const item of items) {
      if (item.isPurchased) continue;
      const month = (item.purchaseMonth || '').trim();
      if (!month) continue;
      const amt = Number(item.budgetAmount) || 0;
      if (amt <= 0) continue;
      const currency = item.currency || config.homeCurrency;
      const prev = map.get(month);
      if (prev) {
        prev.total += amt;
      } else {
        map.set(month, { total: amt, currency });
      }
    }
    return Array.from(map.entries())
      .sort((a, b) => a[0].localeCompare(b[0]))
      .map(([month, { total, currency }]) => ({ month, total, currency }));
  }, [items, config.homeCurrency]);

  const markPurchased = (item: ShoppingItem, purchased: boolean): void => {
    if (!canEditItem(item)) return;
    if (warnIfOffline('write')) return;
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

  const patchShopping = (id: string, partial: Parameters<ShoppingListService['update']>[1]): void => {
    if (warnIfOffline('write')) return;
    service.update(id, partial).then(refresh).catch(console.error);
  };

  const deleteShopping = (id: string): void => {
    if (warnIfOffline('write')) return;
    service.delete(id).then(refresh).catch(console.error);
  };

  const addItem = (): void => {
    if (warnIfOffline('write')) return;
    if (!trip?.id || !name.trim() || adding) return;
    const itemName = name.trim();
    const traveller = addTraveller || activeTraveller || defaultTraveller;
    if (!traveller) {
      window.alert('No travellers available for this trip. Add an Editor or Companion in Access first.');
      return;
    }
    const fallback = categories.find((c) => c.toLowerCase() === 'other') || categories[0] || 'Other';
    const itemCategory = categories.some((c) => c.toLowerCase() === addCategory.toLowerCase())
      ? addCategory
      : fallback;
    rememberTripShoppingCategory(trip.id, itemCategory);
    const budget = Number(addPrice);
    setAdding(true);
    const attempt = (triesLeft: number): void => {
      service
        .create({
          tripId: trip.id,
          itemName,
          category: itemCategory,
          traveller,
          budgetAmount: addPrice.trim() && Number.isFinite(budget) ? Math.max(0, budget) : 0,
          actualAmount: 0,
          currency: config.homeCurrency,
          purchaseMonth: addMonth.trim(),
          websiteUrl: '',
          notes: '',
          isPurchased: false,
          ownerEmail: resolveOwnerEmailForAssignee(spContext, traveller, members)
        })
        .then(() => {
          setName('');
          setAddMonth('');
          setAddPrice('');
          setAddOpen(true);
          refresh();
          flashToast(`${itemName} added`);
          window.setTimeout(() => addNameRef.current?.focus(), 50);
          setAdding(false);
        })
        .catch((err) => {
          const msg = err instanceof Error ? err.message : String(err ?? '');
          if (triesLeft > 0 && /load failed|failed to fetch|network/i.test(msg)) {
            window.setTimeout(() => attempt(triesLeft - 1), 350);
            return;
          }
          // eslint-disable-next-line no-console
          console.error(err);
          window.alert(err instanceof Error ? err.message : 'Could not add shopping item.');
          setAdding(false);
        });
    };
    attempt(2);
  };

  const categoryOptions = (itemCategory: string): string[] => categoriesForItemSelect(categories, itemCategory);

  const onFiltersApply = (draft: ShoppingFilterDraft): void => {
    planView?.setShoppingHasNotesOnly(draft.hasNotesOnly);
  };

  const renderRow = (item: ShoppingItem): React.ReactNode => {
    const editable = canEditItem(item);
    const who = memberForName(item.traveller || travellers[0] || 'Traveller', members);
    const cat = (item.category || 'Uncategorised').trim() || 'Uncategorised';
    const status = shoppingItemStatus(item);
    const notesExpanded = notesOpenId === item.id;
    const hasDetail = !!(item.notes || '').trim() || !!(item.websiteUrl || '').trim();
    const statusClass = status === 'purchased' ? styles.statusPurchased : styles.statusToBuy;
    const statusLabel = status === 'purchased' ? 'Purchased' : 'To buy';

    return (
      <li key={item.id} className={`${styles.row} ${item.isPurchased ? styles.rowPurchased : ''}`.trim()}>
        <div className={styles.rowMain} data-financials={canSeeFinancials ? 'true' : 'false'}>
          <label className={styles.checkWrap}>
            <input
              type="checkbox"
              className={styles.check}
              checked={item.isPurchased}
              disabled={!editable}
              aria-label={`Purchased: ${item.itemName}`}
              onChange={(e) => markPurchased(item, e.target.checked)}
            />
          </label>

          <span className={styles.catIcon} aria-hidden>
            <PackingCategoryIcon category={cat} size={isIpad ? 18 : 16} />
          </span>

          <div className={styles.itemCell}>
            {editable ? (
              <>
                <input
                  className={styles.inlineName}
                  defaultValue={item.itemName}
                  aria-label="Item name"
                  onBlur={(e) => {
                    const v = e.target.value.trim();
                    if (v && v !== item.itemName) {
                      patchShopping(item.id, { itemName: v });
                    }
                  }}
                />
                <select
                  className={styles.inlineCat}
                  value={item.category || 'Uncategorised'}
                  aria-label="Category"
                  onChange={(e) => {
                    if (trip?.id) rememberTripShoppingCategory(trip.id, e.target.value);
                    patchShopping(item.id, { category: e.target.value });
                  }}
                >
                  {categoryOptions(item.category).map((c) => (
                    <option key={c} value={c}>
                      {c}
                    </option>
                  ))}
                </select>
              </>
            ) : (
              <>
                <span className={styles.itemName}>{item.itemName}</span>
                <span className={styles.itemCat}>{cat}</span>
              </>
            )}
          </div>

          <div className={styles.forCell}>
            {editable ? (
              <>
                <TravellerAvatar displayName={who.displayName} avatarUrl={who.avatarUrl} size={isIpad ? 24 : 20} />
                <select
                  className={styles.inlineFor}
                  value={item.traveller || travellers[0] || ''}
                  aria-label="For traveller"
                  onChange={(e) =>
                    patchShopping(item.id, {
                      traveller: e.target.value,
                      ownerEmail: resolveOwnerEmailForAssignee(spContext, e.target.value, members)
                    })
                  }
                >
                  {travellers.map((t) => (
                    <option key={t} value={t}>
                      {t}
                    </option>
                  ))}
                </select>
              </>
            ) : (
              <>
                <TravellerAvatar displayName={who.displayName} avatarUrl={who.avatarUrl} size={isIpad ? 26 : 22} />
                <span className={styles.forName}>{who.displayName.split(/\s+/)[0] || who.displayName}</span>
              </>
            )}
          </div>

          {canSeeFinancials ? (
            <div className={styles.priceCell}>
              {editable ? (
                <input
                  className={styles.inlinePrice}
                  type="number"
                  min={0}
                  step="0.01"
                  defaultValue={item.budgetAmount || ''}
                  aria-label="Estimated price"
                  onBlur={(e) => {
                    const v = Number(e.target.value);
                    if (!Number.isFinite(v) || v === item.budgetAmount) return;
                    patchShopping(item.id, { budgetAmount: Math.max(0, v) });
                  }}
                />
              ) : (
                <span className={styles.priceText}>
                  {item.budgetAmount ? formatCurrency(item.budgetAmount, item.currency || config.homeCurrency) : '—'}
                </span>
              )}
            </div>
          ) : null}

          <div className={styles.monthCell}>
            {editable ? (
              <input
                className={styles.inlineMonth}
                type="month"
                value={item.purchaseMonth || ''}
                aria-label="Estimated purchase month"
                onChange={(e) =>
                  patchShopping(item.id, { purchaseMonth: e.target.value })
                }
              />
            ) : (
              <span className={styles.monthText}>{item.purchaseMonth ? monthLabel(item.purchaseMonth) : '—'}</span>
            )}
          </div>

          <div className={styles.statusCell}>
            <span className={`${styles.statusBadge} ${statusClass}`}>{statusLabel}</span>
          </div>

          <div className={styles.notesCell}>
            <button
              type="button"
              className={`${styles.notesIconBtn} ${hasDetail || notesExpanded ? styles.notesIconBtnOn : ''}`}
              aria-label={notesExpanded ? 'Hide details' : 'Details'}
              aria-expanded={notesExpanded}
              disabled={!editable && !hasDetail}
              onClick={() => setNotesOpenId((prev) => (prev === item.id ? null : item.id))}
            >
              <DetailsIcon />
            </button>
          </div>

          {editable ? (
            <button
              type="button"
              className={styles.deleteIconBtn}
              aria-label={`Delete ${item.itemName}`}
              onClick={() => {
                void (async () => {
                  if (!(await confirmUserAction('Delete this shopping item?'))) return;
                  deleteShopping(item.id);
                })();
              }}
            >
              <DeleteIcon />
            </button>
          ) : (
            <span className={styles.editBtn} />
          )}
        </div>
        {notesExpanded ? (
          <div className={styles.notesExpand}>
            <div className={styles.notesExpandRow}>
              <span className={styles.notesExpandLabel}>Notes</span>
              {editable ? (
                <input
                  className={styles.inlineNotes}
                  type="text"
                  placeholder="Add a note…"
                  value={noteDrafts[item.id] ?? ''}
                  aria-label="Notes"
                  onChange={(e) => setNoteDrafts((prev) => ({ ...prev, [item.id]: e.target.value }))}
                  onBlur={() => {
                    const notes = (noteDrafts[item.id] ?? '').trim();
                    if (notes !== (item.notes || '')) {
                      patchShopping(item.id, { notes });
                    }
                  }}
                />
              ) : (
                <span className={styles.notesText}>{item.notes?.trim() || 'No notes'}</span>
              )}
            </div>
            <div className={styles.notesExpandRow}>
              <span className={styles.notesExpandLabel}>Link</span>
              {editable ? (
                <input
                  className={styles.inlineUrl}
                  type="text"
                  placeholder="Website URL"
                  value={urlDrafts[item.id] ?? ''}
                  aria-label="Website URL"
                  onChange={(e) => setUrlDrafts((prev) => ({ ...prev, [item.id]: e.target.value }))}
                  onBlur={() => {
                    const v = (urlDrafts[item.id] ?? '').trim();
                    if (v !== (item.websiteUrl || '')) {
                      patchShopping(item.id, { websiteUrl: v });
                    }
                  }}
                />
              ) : item.websiteUrl?.trim() ? (
                <a className={styles.linkBtn} href={item.websiteUrl} target="_blank" rel="noopener noreferrer">
                  Open link
                </a>
              ) : (
                <span className={styles.notesText}>No link</span>
              )}
            </div>
            {editable ? (
              <button
                type="button"
                className={styles.linkBtn}
                style={{ alignSelf: 'flex-start', background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}
                onClick={() => {
                  if (!trip?.id) return;
                  void (async () => {
                    const ok = await confirmUserAction(`Add "${item.itemName}" to the packing list?`);
                    if (!ok) return;
                    try {
                      await addShoppingItemToPacking(spContext, trip.id, item, members);
                    } catch (err) {
                      // eslint-disable-next-line no-console
                      console.error('Add to packing failed', err);
                    }
                  })();
                }}
              >
                Add to packing list
              </button>
            ) : null}
          </div>
        ) : null}
      </li>
    );
  };

  return (
    <section
      className={styles.page}
      data-shell={isIpad ? 'ipad-portrait' : undefined}
      aria-label="Shopping list"
    >
      {!embedded ? <h2 className={styles.standaloneTitle}>Shopping</h2> : null}

      <div className={styles.toolbar}>
        <input
          className={styles.search}
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search shopping list…"
          aria-label="Search shopping list"
        />
        <button
          type="button"
          className={filtersOpen || filtersActive ? styles.filterBtnOn : styles.filterBtn}
          aria-expanded={filtersOpen}
          onClick={() => setFiltersOpen(true)}
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" aria-hidden>
            <path d="M4 6h16M7 12h10M10 18h4" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
          </svg>
          Filters
        </button>
        {canAdd ? (
          <button
            type="button"
            className={styles.addBtn}
            onClick={() => {
              setAddOpen(true);
              window.setTimeout(() => addNameRef.current?.focus(), 50);
            }}
          >
            + Add item
          </button>
        ) : null}
      </div>

      <MobileShoppingFilters
        open={filtersOpen}
        onClose={() => setFiltersOpen(false)}
        items={items}
        monthFilters={activeMonths}
        statusFilter={statusFilter}
        hasNotesOnly={hasNotesOnly}
        onApply={onFiltersApply}
      />

      {canSeeFinancials && monthPriceRollup.length > 0 ? (
        <p className={styles.monthRollup} role="status">
          <span className={styles.monthRollupLabel}>Est. to buy by month</span>
          {monthPriceRollup.map((row, i) => (
            <span key={row.month}>
              {i > 0 ? ' · ' : ' '}
              <strong>{monthLabel(row.month)}</strong>:{' '}
              {formatCurrency(row.total, row.currency)}
            </span>
          ))}
        </p>
      ) : null}

      <div className={styles.travellerRow}>
        <span className={styles.travellerLabel}>Filter by traveller</span>
        <div className={styles.travellerChips} role="group" aria-label="Filter by traveller">
          <button
            type="button"
            className={`${styles.travChip} ${activeTraveller === null ? styles.travChipOn : ''}`}
            onClick={() => planView?.setShoppingTraveller(null)}
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
                onClick={() => planView?.setShoppingTraveller(t)}
              >
                <TravellerAvatar displayName={who.displayName} avatarUrl={who.avatarUrl} size={20} />
                <span>{who.displayName.split(/\s+/)[0] || who.displayName}</span>
              </button>
            );
          })}
        </div>
        {activeTraveller ? (
          <button type="button" className={styles.clearTrav} onClick={() => planView?.setShoppingTraveller(null)}>
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

      <div className={styles.tableWrap}>
        <div
          className={`${styles.tableHead} ${styles.rowMain}`}
          data-financials={canSeeFinancials ? 'true' : 'false'}
          aria-hidden={!isIpad}
        >
          <span className={styles.checkWrap} />
          <span className={styles.catIcon} />
          <span className={styles.itemCell}>Item</span>
          <span className={styles.forCell}>For</span>
          {canSeeFinancials ? <span className={styles.priceCell}>Est. price</span> : null}
          <span className={styles.monthCell}>Est. month</span>
          <span className={styles.statusCell}>Status</span>
          <span className={styles.notesCell} />
          <span className={styles.editBtn} />
        </div>
        {canAdd && addOpen ? (
          <div
            className={`${styles.addRow} ${styles.addRowInTable}`}
            data-financials={canSeeFinancials ? 'true' : 'false'}
            role="form"
            aria-label="Add shopping item"
          >
            <span className={styles.checkWrap} />
            <span className={styles.catIcon} aria-hidden>
              <PackingCategoryIcon category={addCategory} size={16} />
            </span>
            <input
              ref={addNameRef}
              className={styles.addName}
              placeholder="New item name…"
              value={name}
              onChange={(e) => setName(e.target.value)}
              aria-label="New item name"
              onKeyDown={(e) => {
                if (e.key === 'Enter') addItem();
                if (e.key === 'Escape') {
                  setAddOpen(false);
                  setName('');
                }
              }}
            />
            <select
              className={styles.addSelect}
              value={addCategory}
              onChange={(e) => setAddCategory(e.target.value)}
              aria-label="Category"
            >
              {categories.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>
            <select
              className={styles.addSelect}
              value={addTraveller || travellers[0] || ''}
              onChange={(e) => setAddTraveller(e.target.value)}
              aria-label="For traveller"
            >
              {travellers.map((t) => (
                <option key={t} value={t}>
                  {t}
                </option>
              ))}
            </select>
            <input
              className={styles.addMonth}
              type="month"
              value={addMonth}
              onChange={(e) => setAddMonth(e.target.value)}
              aria-label="Estimated purchase month"
            />
            {canSeeFinancials ? (
              <input
                className={styles.addPrice}
                type="number"
                min={0}
                step="0.01"
                placeholder={`Price (${config.homeCurrency})`}
                value={addPrice}
                onChange={(e) => setAddPrice(e.target.value)}
                aria-label="Estimated price"
              />
            ) : null}
            <button type="button" className={styles.saveAddBtn} onClick={addItem} disabled={!name.trim() || adding}>
              {adding ? 'Adding…' : 'Add'}
            </button>
          </div>
        ) : null}
        {filtered.length === 0 && !(canAdd && addOpen) ? (
          <p className={chrome.muted} style={{ padding: '0.85rem' }}>
            No shopping items match these filters.
          </p>
        ) : (
          grouped.map((group) => (
            <section key={group.key} className={styles.group}>
              {viewMode === 'grouped' ? (
                <h3 className={styles.groupHeading}>
                  <span className={styles.catIcon} aria-hidden>
                    <PackingCategoryIcon category={group.label} size={16} />
                  </span>
                  {group.label}
                  <span className={styles.groupMeta}>
                    {group.rows.filter((r) => r.isPurchased).length}/{group.rows.length} bought
                  </span>
                </h3>
              ) : null}
              <ul className={styles.list}>{group.rows.map((item) => renderRow(item))}</ul>
            </section>
          ))
        )}
      </div>
    </section>
  );
};
