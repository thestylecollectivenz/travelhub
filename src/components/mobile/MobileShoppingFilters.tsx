import * as React from 'react';
import { usePlanView } from '../../context/PlanViewContext';
import { useTripWorkspace } from '../../context/TripWorkspaceContext';
import { useSpContext } from '../../context/SpContext';
import { useTripShoppingCategories } from '../../hooks/useTripShoppingCategories';
import { useTripPermissions } from '../../hooks/useTripPermissions';
import { confirmUserAction } from '../../utils/confirmAction';
import styles from './MobileShell.module.css';

/** Compact shopping category + traveller filters for mobile lists tab. */
export const MobileShoppingFilters: React.FC<{ travellers: string[] }> = ({ travellers }) => {
  const plan = usePlanView();
  const { trip } = useTripWorkspace();
  const spContext = useSpContext();
  const { categories, addCategory, renameCategory, deleteCategory } = useTripShoppingCategories(trip?.id, spContext);
  const { canManageTrip } = useTripPermissions();
  const [newCategoryName, setNewCategoryName] = React.useState('');
  const [editingCategory, setEditingCategory] = React.useState<string | null>(null);
  const [editCategoryName, setEditCategoryName] = React.useState('');
  const [manageOpen, setManageOpen] = React.useState(false);

  if (!plan) return null;

  const traveller = plan.shoppingTraveller ?? null;
  const category = plan.shoppingCategory ?? '__all__';

  return (
    <div className={styles.mobileListFilters}>
      <div className={styles.filterGroup}>
        <span className={styles.filterLabel}>Traveller</span>
        <div className={styles.filterChips}>
          <button
            type="button"
            className={`${styles.pagerBtn} ${traveller === null ? styles.pagerBtnActive : ''}`}
            onClick={() => plan.setShoppingTraveller(null)}
          >
            All
          </button>
          {travellers.map((name) => (
            <button
              key={name}
              type="button"
              className={`${styles.pagerBtn} ${traveller === name ? styles.pagerBtnActive : ''}`}
              onClick={() => plan.setShoppingTraveller(name)}
            >
              {name}
            </button>
          ))}
        </div>
      </div>

      <div className={styles.filterGroup}>
        <span className={styles.filterLabel}>Categories</span>
        <div className={styles.filterChips}>
          <button
            type="button"
            className={`${styles.pagerBtn} ${category === '__all__' ? styles.pagerBtnActive : ''}`}
            onClick={() => plan.setShoppingCategory('__all__')}
          >
            All
          </button>
          {categories.map((c) => (
            <button
              key={c}
              type="button"
              className={`${styles.pagerBtn} ${category === c ? styles.pagerBtnActive : ''}`}
              onClick={() => plan.setShoppingCategory(c)}
            >
              {c}
            </button>
          ))}
        </div>
        {canManageTrip ? (
        <div className={styles.filterAddRow}>
          <input
            className={styles.dateInput}
            placeholder="New category"
            value={newCategoryName}
            onChange={(e) => setNewCategoryName(e.target.value)}
            onKeyDown={(e) => {
              if (e.key !== 'Enter') return;
              const next = newCategoryName.trim();
              if (!next) return;
              addCategory(next);
              setNewCategoryName('');
              plan.setShoppingCategory(next);
            }}
          />
          <button
            type="button"
            className={styles.pagerBtn}
            onClick={() => {
              const next = newCategoryName.trim();
              if (!next) return;
              addCategory(next);
              setNewCategoryName('');
              plan.setShoppingCategory(next);
            }}
          >
            Add
          </button>
        </div>
        ) : null}
        {canManageTrip && categories.length > 0 ? (
          <>
            <button
              type="button"
              className={styles.pagerBtn}
              onClick={() => setManageOpen((v) => !v)}
            >
              {manageOpen ? 'Hide category manager' : 'Manage categories'}
            </button>
            {manageOpen ? (
          <ul className={styles.categoryManageList}>
            {categories.map((c) => (
              <li key={c} className={styles.categoryManageRow}>
                {editingCategory === c ? (
                  <>
                    <input
                      className={styles.dateInput}
                      value={editCategoryName}
                      onChange={(e) => setEditCategoryName(e.target.value)}
                      aria-label="Category name"
                    />
                    <button
                      type="button"
                      className={styles.pagerBtn}
                      onClick={() => {
                        void (async () => {
                          const next = editCategoryName.trim();
                          if (!next || next.toLowerCase() === c.toLowerCase()) {
                            setEditingCategory(null);
                            return;
                          }
                          await renameCategory(c, next);
                          if (category === c) plan.setShoppingCategory(next);
                          setEditingCategory(null);
                        })();
                      }}
                    >
                      Save
                    </button>
                  </>
                ) : (
                  <>
                    <span className={styles.filterLabel}>{c}</span>
                    <button type="button" className={styles.pagerBtn} onClick={() => { setEditingCategory(c); setEditCategoryName(c); }}>
                      Rename
                    </button>
                    <button
                      type="button"
                      className={styles.pagerBtn}
                      onClick={() => {
                        void (async () => {
                          if (!(await confirmUserAction(`Delete category "${c}"?`))) return;
                          await deleteCategory(c);
                          if (category === c) plan.setShoppingCategory('__all__');
                        })();
                      }}
                    >
                      Delete
                    </button>
                  </>
                )}
              </li>
            ))}
          </ul>
            ) : null}
          </>
        ) : null}
      </div>
    </div>
  );
};
