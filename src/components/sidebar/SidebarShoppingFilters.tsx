import * as React from 'react';
import { usePlanView } from '../../context/PlanViewContext';
import { useTripWorkspace } from '../../context/TripWorkspaceContext';
import { useSpContext } from '../../context/SpContext';
import { confirmUserAction } from '../../utils/confirmAction';
import { useTripShoppingCategories } from '../../hooks/useTripShoppingCategories';
import { useTripMembers } from '../../hooks/useTripMembers';
import { isAllCategories, renameInMulti } from '../../utils/multiSelectFilters';
import { SHOPPING_UNSCHEDULED_MONTH } from '../../utils/shoppingSummary';
import styles from './TripSidebar.module.css';

export const SidebarShoppingFilters: React.FC = () => {
  const plan = usePlanView();
  const { trip } = useTripWorkspace();
  const spContext = useSpContext();
  const { categories, addCategory, renameCategory, deleteCategory, restoreDefaults } = useTripShoppingCategories(
    trip?.id,
    spContext
  );
  const { travellers } = useTripMembers(trip?.id);
  const traveller = plan?.shoppingTraveller ?? null;
  const categoryFilters = plan?.shoppingCategories ?? [];
  const monthFilters = plan?.shoppingMonthFilters ?? [];
  const [newCategoryName, setNewCategoryName] = React.useState('');
  const [editingCategory, setEditingCategory] = React.useState<string | null>(null);
  const [editCategoryName, setEditCategoryName] = React.useState('');

  if (!plan) return null;

  return (
    <div className={styles.dayListSection}>
      <h2 className={styles.dayListHeading}>Traveller</h2>
      <div className={styles.travellerRow}>
        <button
          type="button"
          className={`${styles.packingCatBtn} ${traveller === null ? styles.packingCatBtnActive : ''}`}
          onClick={() => plan.setShoppingTraveller(null)}
        >
          All
        </button>
        {travellers.map((name) => (
          <button
            key={name}
            type="button"
            className={`${styles.packingCatBtn} ${traveller === name ? styles.packingCatBtnActive : ''}`}
            onClick={() => plan.setShoppingTraveller(name)}
          >
            {name}
          </button>
        ))}
      </div>

      <h2 className={styles.dayListHeading}>Master category list</h2>
      <p className={styles.dayListHint}>
        Shared packing + shopping categories. Add custom names below. Built-in categories cannot be deleted — use Restore
        full list if chips look culled.
      </p>
      <div className={styles.travellerAddRow}>
        <button type="button" className={styles.travellerActionBtn} onClick={() => restoreDefaults()}>
          Restore full default list
        </button>
      </div>
      <ul className={styles.dayList}>
        <li>
          <button
            type="button"
            className={`${styles.packingCatBtn} ${isAllCategories(categoryFilters) ? styles.packingCatBtnActive : ''}`}
            onClick={() => plan.setShoppingCategories([])}
          >
            All categories
          </button>
        </li>
        {categories.length === 0 ? (
          <li className={styles.dayListHint}>No categories yet — add one below.</li>
        ) : (
          categories.map((c) => (
            <li key={c}>
              {editingCategory === c ? (
                <div className={styles.travellerEditRow}>
                  <input
                    className={styles.travellerInput}
                    value={editCategoryName}
                    onChange={(e) => setEditCategoryName(e.target.value)}
                    aria-label="Category name"
                  />
                  <button
                    type="button"
                    className={styles.travellerActionBtn}
                    onClick={() => {
                      void (async () => {
                        const next = editCategoryName.trim();
                        if (!next || next.toLowerCase() === c.toLowerCase()) {
                          setEditingCategory(null);
                          return;
                        }
                        await renameCategory(c, next);
                        if (categoryFilters.indexOf(c) >= 0) {
                          plan.setShoppingCategories(renameInMulti(categoryFilters, c, next));
                        }
                        setEditingCategory(null);
                      })();
                    }}
                  >
                    Save
                  </button>
                </div>
              ) : (
                <div className={styles.travellerRow}>
                  <button
                    type="button"
                    className={`${styles.packingCatBtn} ${categoryFilters.indexOf(c) >= 0 ? styles.packingCatBtnActive : ''}`}
                    onClick={() => plan.setShoppingCategories([c])}
                  >
                    {c}
                  </button>
                  <button
                    type="button"
                    className={styles.travellerActionBtn}
                    title="Rename category"
                    onClick={() => {
                      setEditingCategory(c);
                      setEditCategoryName(c);
                    }}
                  >
                    ✎
                  </button>
                  <button
                    type="button"
                    className={styles.travellerActionBtn}
                    title="Delete unused category"
                    onClick={() => {
                      void (async () => {
                        if (!(await confirmUserAction(`Delete category "${c}"? Only unused categories can be removed.`))) return;
                        try {
                          await deleteCategory(c);
                          if (categoryFilters.indexOf(c) >= 0) {
                            plan.setShoppingCategories(categoryFilters.filter((x) => x !== c));
                          }
                        } catch (err) {
                          window.alert(err instanceof Error ? err.message : 'Could not delete category.');
                        }
                      })();
                    }}
                  >
                    ×
                  </button>
                </div>
              )}
            </li>
          ))
        )}
      </ul>
      <div className={styles.travellerAddRow}>
        <input
          className={styles.travellerInput}
          placeholder="New category name"
          value={newCategoryName}
          onChange={(e) => setNewCategoryName(e.target.value)}
          onKeyDown={(e) => {
            if (e.key !== 'Enter') return;
            const next = newCategoryName.trim();
            if (!next) return;
            addCategory(next);
            setNewCategoryName('');
            plan.setShoppingCategories([next]);
          }}
        />
        <button
          type="button"
          className={styles.travellerActionBtn}
          onClick={() => {
            const next = newCategoryName.trim();
            if (!next) return;
            if (categories.some((c) => c.toLowerCase() === next.toLowerCase())) {
              setNewCategoryName('');
              return;
            }
            addCategory(next);
            setNewCategoryName('');
            plan.setShoppingCategories([next]);
          }}
        >
          Add
        </button>
      </div>

      {monthFilters.length ? (
        <p className={styles.dayListHint}>
          Month filter:{' '}
          {monthFilters.map((m) => (m === SHOPPING_UNSCHEDULED_MONTH ? 'Unscheduled' : m)).join(', ')}{' '}
          <button type="button" className={styles.packingCatBtn} onClick={() => plan.setShoppingMonthFilters([])}>
            All months
          </button>
        </p>
      ) : null}
    </div>
  );
};
