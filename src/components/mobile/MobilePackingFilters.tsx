import * as React from 'react';
import { createPortal } from 'react-dom';
import { usePlanView } from '../../context/PlanViewContext';
import { useTripWorkspace } from '../../context/TripWorkspaceContext';
import { useSpContext } from '../../context/SpContext';
import { useTripShoppingCategories } from '../../hooks/useTripShoppingCategories';
import { useTripPermissions } from '../../hooks/useTripPermissions';
import { confirmUserAction } from '../../utils/confirmAction';
import { PackingItem } from '../../services/PackingService';
import { PackingCategoryIcon } from './packingCategoryIcon';
import { useShellMode } from '../../hooks/useShellMode';
import styles from './MobilePackingFilters.module.css';

export type PackingPackedFilter = 'all' | 'packed' | 'unpacked';

export interface PackingFilterDraft {
  category: string;
  packedFilter: PackingPackedFilter;
  hasNotesOnly: boolean;
  hasQtyGt1: boolean;
}

export interface MobilePackingFiltersProps {
  open: boolean;
  onClose: () => void;
  items: PackingItem[];
  packedFilter: PackingPackedFilter;
  hasNotesOnly: boolean;
  hasQtyGt1: boolean;
  onApply: (draft: PackingFilterDraft) => void;
}

const CAT_PREVIEW = 8;

/** Right slide-out filters for packing list (iPad mockup layout). */
export const MobilePackingFilters: React.FC<MobilePackingFiltersProps> = ({
  open,
  onClose,
  items,
  packedFilter,
  hasNotesOnly,
  hasQtyGt1,
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
  const [draft, setDraft] = React.useState<PackingFilterDraft>({
    category: '__all__',
    packedFilter: 'all',
    hasNotesOnly: false,
    hasQtyGt1: false
  });

  React.useEffect(() => {
    if (!open || !plan) return;
    setDraft({
      category: plan.packingCategory ?? '__all__',
      packedFilter,
      hasNotesOnly,
      hasQtyGt1
    });
    setCatQuery('');
    setManageError('');
  }, [open, plan, packedFilter, hasNotesOnly, hasQtyGt1]);

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
    return categories.filter((c) => !q || c.toLowerCase().includes(q));
  }, [categories, catQuery]);

  const visibleCats = showAllCats || catQuery.trim() ? filteredCats : filteredCats.slice(0, CAT_PREVIEW);

  if (!open || !plan) return null;

  const apply = (): void => {
    plan.setPackingCategory(draft.category);
    onApply(draft);
    onClose();
  };

  const reset = (): void => {
    setDraft({
      category: '__all__',
      packedFilter: 'all',
      hasNotesOnly: false,
      hasQtyGt1: false
    });
  };

  const panel = (
    <>
      <button type="button" className={styles.backdrop} aria-label="Close filters" onClick={onClose} />
      <aside
        className={styles.drawer}
        data-shell={shellMode === 'ipad-portrait' ? 'ipad-portrait' : undefined}
        role="dialog"
        aria-modal="true"
        aria-labelledby="packing-filters-title"
      >
        <div className={styles.header}>
          <h2 id="packing-filters-title" className={styles.title}>
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
            <ul className={styles.catList}>
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
            <p className={styles.sectionTitle}>Item status</p>
            <ul className={styles.statusList}>
              {(
                [
                  { key: 'all' as const, label: 'All items' },
                  { key: 'packed' as const, label: 'Packed' },
                  { key: 'unpacked' as const, label: 'Not packed' }
                ]
              ).map((opt) => (
                <li key={opt.key}>
                  <button
                    type="button"
                    className={styles.statusRow}
                    onClick={() => setDraft((d) => ({ ...d, packedFilter: opt.key }))}
                  >
                    <span>{opt.label}</span>
                    <span
                      className={`${styles.radio} ${draft.packedFilter === opt.key ? styles.radioOn : ''}`}
                      aria-hidden
                    >
                      {draft.packedFilter === opt.key ? '✓' : ''}
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
            <div className={styles.toggleRow}>
              <span className={styles.toggleLabel}>Has quantity &gt; 1</span>
              <button
                type="button"
                className={`${styles.switch} ${draft.hasQtyGt1 ? styles.switchOn : ''}`}
                role="switch"
                aria-checked={draft.hasQtyGt1}
                aria-label="Has quantity greater than 1"
                onClick={() => setDraft((d) => ({ ...d, hasQtyGt1: !d.hasQtyGt1 }))}
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
                                    if (plan.packingCategory === c) plan.setPackingCategory(next);
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
                                      if (plan.packingCategory === c) plan.setPackingCategory('__all__');
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
                                  {counts.get(c)} packing item{(counts.get(c) ?? 0) === 1 ? '' : 's'} — reassign to
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
