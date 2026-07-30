import * as React from 'react';
import { createPortal } from 'react-dom';
import { usePlanView } from '../../context/PlanViewContext';
import { useTripWorkspace } from '../../context/TripWorkspaceContext';
import { useSpContext } from '../../context/SpContext';
import { useTripShoppingCategories } from '../../hooks/useTripShoppingCategories';
import { useTripPermissions } from '../../hooks/useTripPermissions';
import { confirmUserAction } from '../../utils/confirmAction';
import { ShoppingItem } from '../../services/ShoppingListService';
import { PackingCategoryIcon } from './packingCategoryIcon';
import { useShellMode } from '../../hooks/useShellMode';
import styles from './MobilePackingFilters.module.css';

export type ShoppingStatusFilter = 'all' | 'tobuy' | 'purchased';

/** Derives shopping status: purchased vs to-buy. Website URL is informational only. */
export function shoppingItemStatus(item: ShoppingItem): 'tobuy' | 'purchased' {
  if (item.isPurchased) return 'purchased';
  return 'tobuy';
}

export interface ShoppingFilterDraft {
  category: string;
  monthFilter: string | null;
  statusFilter: ShoppingStatusFilter;
  hasNotesOnly: boolean;
}

export interface MobileShoppingFiltersProps {
  open: boolean;
  onClose: () => void;
  items: ShoppingItem[];
  monthFilter: string | null;
  statusFilter: ShoppingStatusFilter;
  hasNotesOnly: boolean;
  onApply: (draft: ShoppingFilterDraft) => void;
}

const CAT_PREVIEW = 8;

export function monthLabel(month: string): string {
  const match = /^(\d{4})-(\d{2})$/.exec(month);
  if (!match) return month;
  const date = new Date(Number(match[1]), Number(match[2]) - 1, 1);
  if (Number.isNaN(date.getTime())) return month;
  return date.toLocaleDateString('en-NZ', { month: 'short', year: 'numeric' });
}

/** Right slide-out filters for shopping list (mirrors packing filters layout). */
export const MobileShoppingFilters: React.FC<MobileShoppingFiltersProps> = ({
  open,
  onClose,
  items,
  monthFilter,
  statusFilter,
  hasNotesOnly,
  onApply
}) => {
  const plan = usePlanView();
  const { trip } = useTripWorkspace();
  const spContext = useSpContext();
  const shellMode = useShellMode();
  const { categories, addCategory, renameCategory, deleteCategory, restoreDefaults } = useTripShoppingCategories(
    trip?.id,
    spContext
  );
  const { canManageTrip } = useTripPermissions();
  const [catQuery, setCatQuery] = React.useState('');
  const [showAllCats, setShowAllCats] = React.useState(false);
  const [manageOpen, setManageOpen] = React.useState(false);
  const [newCategoryName, setNewCategoryName] = React.useState('');
  const [editingCategory, setEditingCategory] = React.useState<string | null>(null);
  const [editCategoryName, setEditCategoryName] = React.useState('');
  const [manageError, setManageError] = React.useState('');
  const [draft, setDraft] = React.useState<ShoppingFilterDraft>({
    category: '__all__',
    monthFilter: null,
    statusFilter: 'all',
    hasNotesOnly: false
  });

  React.useEffect(() => {
    if (!open || !plan) return;
    setDraft({
      category: plan.shoppingCategory ?? '__all__',
      monthFilter,
      statusFilter,
      hasNotesOnly
    });
    setCatQuery('');
    setManageError('');
  }, [open, plan, monthFilter, statusFilter, hasNotesOnly]);

  React.useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent): void => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  const counts = React.useMemo(() => {
    const map = new Map<string, number>();
    for (const item of items) {
      const key = (item.category || 'Other').trim() || 'Other';
      map.set(key, (map.get(key) ?? 0) + 1);
    }
    return map;
  }, [items]);

  const filteredCats = React.useMemo(() => {
    const q = catQuery.trim().toLowerCase();
    const rows = categories.filter((c) => !q || c.toLowerCase().includes(q));
    const withItems = rows
      .filter((c) => (counts.get(c) ?? 0) > 0)
      .sort((a, b) => {
        const diff = (counts.get(b) ?? 0) - (counts.get(a) ?? 0);
        if (diff !== 0) return diff;
        return a.localeCompare(b, undefined, { sensitivity: 'base' });
      });
    const empty = rows
      .filter((c) => (counts.get(c) ?? 0) === 0)
      .sort((a, b) => a.localeCompare(b, undefined, { sensitivity: 'base' }));
    return [...withItems, ...empty];
  }, [categories, catQuery, counts]);

  const visibleCats = showAllCats || catQuery.trim() ? filteredCats : filteredCats.slice(0, CAT_PREVIEW);

  const months = React.useMemo(() => {
    const set = new Set<string>();
    for (const item of items) {
      const m = (item.purchaseMonth || '').trim();
      if (m) set.add(m);
    }
    return Array.from(set).sort((a, b) => a.localeCompare(b));
  }, [items]);

  const statusCounts = React.useMemo(() => {
    const out = { tobuy: 0, purchased: 0 };
    for (const item of items) {
      out[shoppingItemStatus(item)] += 1;
    }
    return out;
  }, [items]);

  if (!open) return null;

  const apply = (): void => {
    if (plan) {
      plan.setShoppingCategory(draft.category);
      plan.setShoppingMonthFilter(draft.monthFilter);
      plan.setShoppingStatusFilter(draft.statusFilter);
    }
    onApply(draft);
    onClose();
  };

  const reset = (): void => {
    const defaults: ShoppingFilterDraft = {
      category: '__all__',
      monthFilter: null,
      statusFilter: 'all',
      hasNotesOnly: false
    };
    setDraft(defaults);
    if (plan) {
      plan.setShoppingCategory('__all__');
      plan.setShoppingMonthFilter(null);
      plan.setShoppingTraveller(null);
      plan.setShoppingStatusFilter('all');
    }
    onApply(defaults);
  };

  const panel = (
    <>
      <button type="button" className={styles.backdrop} aria-label="Close filters" onClick={onClose} />
      <aside
        className={styles.drawer}
        data-shell={shellMode === 'ipad-portrait' ? 'ipad-portrait' : undefined}
        role="dialog"
        aria-modal="true"
        aria-labelledby="shopping-filters-title"
      >
        <div className={styles.header}>
          <h2 id="shopping-filters-title" className={styles.title}>
            Filters
          </h2>
          <button type="button" className={styles.closeBtn} aria-label="Close" onClick={onClose}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" aria-hidden>
              <path d="M6 6l12 12M18 6 6 18" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
            </svg>
          </button>
        </div>

        <div className={styles.body}>
          <section>
            <p className={styles.sectionTitle}>Category</p>
            <input
              className={styles.catSearch}
              value={catQuery}
              onChange={(e) => setCatQuery(e.target.value)}
              placeholder="Search categories…"
              aria-label="Search categories"
            />
            <ul className={`${styles.catList} ${showAllCats || catQuery.trim() ? '' : styles.catListPreview}`.trim()}>
              <li>
                <button
                  type="button"
                  className={`${styles.catRow} ${draft.category === '__all__' ? styles.catRowOn : ''}`}
                  onClick={() => setDraft((d) => ({ ...d, category: '__all__' }))}
                >
                  <span className={styles.catIcon} aria-hidden>
                    <PackingCategoryIcon category="All" size={14} />
                  </span>
                  <span className={styles.catName}>All categories</span>
                  <span className={styles.catCount}>{items.length}</span>
                  <span className={`${styles.radio} ${draft.category === '__all__' ? styles.radioOn : ''}`} aria-hidden>
                    {draft.category === '__all__' ? '✓' : ''}
                  </span>
                </button>
              </li>
              {visibleCats.map((c) => (
                <li key={c}>
                  <button
                    type="button"
                    className={`${styles.catRow} ${draft.category === c ? styles.catRowOn : ''}`}
                    onClick={() => setDraft((d) => ({ ...d, category: c }))}
                  >
                    <span className={styles.catIcon} aria-hidden>
                      <PackingCategoryIcon category={c} size={14} />
                    </span>
                    <span className={styles.catName}>{c}</span>
                    <span className={styles.catCount}>{counts.get(c) ?? 0}</span>
                    <span className={`${styles.radio} ${draft.category === c ? styles.radioOn : ''}`} aria-hidden>
                      {draft.category === c ? '✓' : ''}
                    </span>
                  </button>
                </li>
              ))}
            </ul>
            {!catQuery.trim() && filteredCats.length > CAT_PREVIEW ? (
              <button type="button" className={styles.showMore} onClick={() => setShowAllCats((v) => !v)}>
                {showAllCats ? 'Show less' : `Show more (${filteredCats.length - CAT_PREVIEW})`}
              </button>
            ) : null}
          </section>

          <section>
            <p className={styles.sectionTitle}>Buy by month</p>
            <ul className={styles.statusList}>
              <li>
                <button
                  type="button"
                  className={styles.statusRow}
                  onClick={() => setDraft((d) => ({ ...d, monthFilter: null }))}
                >
                  <span>All months</span>
                  <span className={`${styles.radio} ${draft.monthFilter === null ? styles.radioOn : ''}`} aria-hidden>
                    {draft.monthFilter === null ? '✓' : ''}
                  </span>
                </button>
              </li>
              <li>
                <button
                  type="button"
                  className={styles.statusRow}
                  onClick={() => setDraft((d) => ({ ...d, monthFilter: '__unscheduled__' }))}
                >
                  <span>Unscheduled</span>
                  <span
                    className={`${styles.radio} ${draft.monthFilter === '__unscheduled__' ? styles.radioOn : ''}`}
                    aria-hidden
                  >
                    {draft.monthFilter === '__unscheduled__' ? '✓' : ''}
                  </span>
                </button>
              </li>
              {months.map((m) => (
                <li key={m}>
                  <button
                    type="button"
                    className={styles.statusRow}
                    onClick={() => setDraft((d) => ({ ...d, monthFilter: m }))}
                  >
                    <span>{monthLabel(m)}</span>
                    <span className={`${styles.radio} ${draft.monthFilter === m ? styles.radioOn : ''}`} aria-hidden>
                      {draft.monthFilter === m ? '✓' : ''}
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          </section>

          <section>
            <p className={styles.sectionTitle}>Item status</p>
            <ul className={styles.statusList}>
              {(
                [
                  { key: 'all' as const, label: 'All items' },
                  { key: 'tobuy' as const, label: `To buy (${statusCounts.tobuy})` },
                  { key: 'purchased' as const, label: `Purchased (${statusCounts.purchased})` }
                ]
              ).map((opt) => (
                <li key={opt.key}>
                  <button
                    type="button"
                    className={styles.statusRow}
                    onClick={() => setDraft((d) => ({ ...d, statusFilter: opt.key }))}
                  >
                    <span>{opt.label}</span>
                    <span
                      className={`${styles.radio} ${draft.statusFilter === opt.key ? styles.radioOn : ''}`}
                      aria-hidden
                    >
                      {draft.statusFilter === opt.key ? '✓' : ''}
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          </section>

          <section>
            <p className={styles.sectionTitle}>Other filters</p>
            <div className={styles.toggleRow}>
              <span className={styles.toggleLabel}>Has notes</span>
              <button
                type="button"
                className={`${styles.switch} ${draft.hasNotesOnly ? styles.switchOn : ''}`}
                role="switch"
                aria-checked={draft.hasNotesOnly}
                aria-label="Has notes"
                onClick={() => setDraft((d) => ({ ...d, hasNotesOnly: !d.hasNotesOnly }))}
              >
                <span className={styles.switchKnob} />
              </button>
            </div>
          </section>

          {canManageTrip ? (
            <section>
              <button type="button" className={styles.manageToggle} onClick={() => setManageOpen((v) => !v)}>
                {manageOpen ? 'Hide master category list' : 'Edit master category list'}
              </button>
              {manageOpen ? (
                <div>
                  <p className={styles.manageHint}>
                    Shared packing + shopping categories for this trip. Unused categories (including defaults) can be
                    deleted. Restore defaults anytime to bring the full list back.
                  </p>
                  <div className={styles.addRow}>
                    <input
                      className={styles.addInput}
                      placeholder="New category"
                      value={newCategoryName}
                      onChange={(e) => setNewCategoryName(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key !== 'Enter') return;
                        const next = newCategoryName.trim();
                        if (!next) return;
                        addCategory(next);
                        setNewCategoryName('');
                      }}
                    />
                    <button
                      type="button"
                      className={styles.addBtn}
                      onClick={() => {
                        const next = newCategoryName.trim();
                        if (!next) return;
                        addCategory(next);
                        setNewCategoryName('');
                      }}
                    >
                      Add
                    </button>
                    <button type="button" className={styles.smallBtn} onClick={() => restoreDefaults()}>
                      Restore defaults
                    </button>
                  </div>
                  {manageError ? <p className={styles.errorText}>{manageError}</p> : null}
                  <ul className={styles.manageList}>
                    {categories.map((c) => {
                      const used = (counts.get(c) ?? 0) > 0;
                      return (
                        <li key={c} className={styles.manageRow}>
                          {editingCategory === c ? (
                            <>
                              <input
                                className={styles.addInput}
                                value={editCategoryName}
                                onChange={(e) => setEditCategoryName(e.target.value)}
                                aria-label="Category name"
                              />
                              <button
                                type="button"
                                className={styles.smallBtn}
                                onClick={() => {
                                  void (async () => {
                                    const next = editCategoryName.trim();
                                    if (!next || next.toLowerCase() === c.toLowerCase()) {
                                      setEditingCategory(null);
                                      return;
                                    }
                                    await renameCategory(c, next);
                                    if (draft.category === c) setDraft((d) => ({ ...d, category: next }));
                                    if (plan.shoppingCategory === c) plan.setShoppingCategory(next);
                                    setEditingCategory(null);
                                  })();
                                }}
                              >
                                Save
                              </button>
                            </>
                          ) : (
                            <>
                              <span className={styles.manageName}>{c}</span>
                              <button
                                type="button"
                                className={styles.smallBtn}
                                onClick={() => {
                                  setEditingCategory(c);
                                  setEditCategoryName(c);
                                  setManageError('');
                                }}
                              >
                                Rename
                              </button>
                              <button
                                type="button"
                                className={styles.dangerBtn}
                                disabled={used}
                                title={used ? 'Reassign items using this category before deleting' : `Delete ${c}`}
                                onClick={() => {
                                  void (async () => {
                                    if (!(await confirmUserAction(`Delete category “${c}”?`))) return;
                                    try {
                                      setManageError('');
                                      await deleteCategory(c);
                                      if (draft.category === c) setDraft((d) => ({ ...d, category: '__all__' }));
                                      if (plan.shoppingCategory === c) plan.setShoppingCategory('__all__');
                                    } catch (err) {
                                      setManageError(err instanceof Error ? err.message : 'Could not delete category.');
                                    }
                                  })();
                                }}
                              >
                                {used ? 'In use' : 'Delete'}
                              </button>
                              {used ? (
                                <span className={styles.manageMeta}>
                                  {counts.get(c)} shopping item{(counts.get(c) ?? 0) === 1 ? '' : 's'} — reassign to
                                  delete
                                </span>
                              ) : null}
                            </>
                          )}
                        </li>
                      );
                    })}
                  </ul>
                </div>
              ) : null}
            </section>
          ) : null}
        </div>

        <div className={styles.footer}>
          <button type="button" className={styles.resetBtn} onClick={reset}>
            Reset
          </button>
          <button type="button" className={styles.applyBtn} onClick={apply}>
            Apply filters
          </button>
        </div>
      </aside>
    </>
  );

  return createPortal(panel, document.body);
};
