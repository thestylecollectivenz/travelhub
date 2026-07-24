import * as React from 'react';
import { usePlanView } from '../../context/PlanViewContext';
import { useTripWorkspace } from '../../context/TripWorkspaceContext';
import { useSpContext } from '../../context/SpContext';
import { confirmUserAction } from '../../utils/confirmAction';
import { useTripShoppingCategories } from '../../hooks/useTripShoppingCategories';
import { useTripMembers } from '../../hooks/useTripMembers';
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
  const category = plan?.shoppingCategory ?? '__all__';
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
            className={`${styles.packingCatBtn} ${category === '__all__' ? styles.packingCatBtnActive : ''}`}
            onClick={() => plan.setShoppingCategory('__all__')}
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
                        if (category === c) plan.setShoppingCategory(next);
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
                    className={`${styles.packingCatBtn} ${category === c ? styles.packingCatBtnActive : ''}`}
                    onClick={() => plan.setShoppingCategory(c)}
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
                          if (category === c) plan.setShoppingCategory('__all__');
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
            plan.setShoppingCategory(next);
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
            plan.setShoppingCategory(next);
          }}
        >
          Add
        </button>
      </div>

      {plan.shoppingMonthFilter ? (
        <p className={styles.dayListHint}>
          Month filter:{' '}
          {plan.shoppingMonthFilter === '__unscheduled__' ? 'Unscheduled' : plan.shoppingMonthFilter}{' '}
          <button type="button" className={styles.packingCatBtn} onClick={() => plan.setShoppingMonthFilter(null)}>
            All months
          </button>
        </p>
      ) : null}
    </div>
  );
};
