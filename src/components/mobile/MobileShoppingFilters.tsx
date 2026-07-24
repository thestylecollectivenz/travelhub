import * as React from 'react';
import { usePlanView } from '../../context/PlanViewContext';
import { useTripWorkspace } from '../../context/TripWorkspaceContext';
import { useSpContext } from '../../context/SpContext';
import { useTripShoppingCategories } from '../../hooks/useTripShoppingCategories';
import { useTripPermissions } from '../../hooks/useTripPermissions';
import { confirmUserAction } from '../../utils/confirmAction';
import chrome from './MobileTabChrome.module.css';
import shell from './MobileShell.module.css';

/** Compact shopping category + traveller filters for mobile lists tab. */
export const MobileShoppingFilters: React.FC<{ travellers: string[] }> = ({ travellers }) => {
  const plan = usePlanView();
  const { trip } = useTripWorkspace();
  const spContext = useSpContext();
  const { categories, addCategory, renameCategory, deleteCategory, restoreDefaults } = useTripShoppingCategories(
    trip?.id,
    spContext
  );
  const { canManageTrip } = useTripPermissions();
  const [newCategoryName, setNewCategoryName] = React.useState('');
  const [editingCategory, setEditingCategory] = React.useState<string | null>(null);
  const [editCategoryName, setEditCategoryName] = React.useState('');
  const [manageOpen, setManageOpen] = React.useState(false);

  if (!plan) return null;

  const traveller = plan.shoppingTraveller ?? null;
  const category = plan.shoppingCategory ?? '__all__';

  const month = plan.shoppingMonthFilter ?? null;

  return (
    <div className={chrome.filterPanel}>
      <div>
        <p className={chrome.filterGroupTitle}>Assigned to</p>
        <div className={chrome.chipRow}>
          <button
            type="button"
            className={`${chrome.chip} ${traveller === null ? chrome.chipActive : ''}`}
            onClick={() => plan.setShoppingTraveller(null)}
          >
            All
          </button>
          <button
            type="button"
            className={`${chrome.chip} ${traveller === '__unassigned__' ? chrome.chipActive : ''}`}
            onClick={() => plan.setShoppingTraveller('__unassigned__')}
          >
            Unassigned
          </button>
          {travellers.map((name) => (
            <button
              key={name}
              type="button"
              className={`${chrome.chip} ${traveller === name ? chrome.chipActive : ''}`}
              onClick={() => plan.setShoppingTraveller(name)}
            >
              {name}
            </button>
          ))}
        </div>
      </div>

      <div>
        <p className={chrome.filterGroupTitle}>Categories</p>
        <div className={chrome.chipRow}>
          <button
            type="button"
            className={`${chrome.chip} ${category === '__all__' ? chrome.chipActive : ''}`}
            onClick={() => plan.setShoppingCategory('__all__')}
          >
            All
          </button>
          <button
            type="button"
            className={`${chrome.chip} ${category === '__uncategorised__' ? chrome.chipActive : ''}`}
            onClick={() => plan.setShoppingCategory('__uncategorised__')}
          >
            Uncategorised
          </button>
          {categories.map((c) => (
            <button
              key={c}
              type="button"
              className={`${chrome.chip} ${category === c ? chrome.chipActive : ''}`}
              onClick={() => plan.setShoppingCategory(c)}
            >
              {c}
            </button>
          ))}
        </div>
        {canManageTrip ? (
        <div className={shell.filterAddRow}>
          <input
            className={shell.dateInput}
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
            className={chrome.chip}
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
              className={chrome.chip}
              onClick={() => setManageOpen((v) => !v)}
            >
              {manageOpen ? 'Hide master category list' : 'Edit master category list'}
            </button>
            {manageOpen ? (
          <div>
            <p className={shell.filterLabel}>
              Shared packing + shopping categories for this trip. Built-in categories cannot be deleted.
            </p>
            <div className={shell.filterAddRow}>
              <button
                type="button"
                className={chrome.chip}
                onClick={() => {
                  restoreDefaults();
                }}
              >
                Restore full default list
              </button>
            </div>
          <ul className={shell.categoryManageList}>
            {categories.map((c) => (
              <li key={c} className={shell.categoryManageRow}>
                {editingCategory === c ? (
                  <>
                    <input
                      className={shell.dateInput}
                      value={editCategoryName}
                      onChange={(e) => setEditCategoryName(e.target.value)}
                      aria-label="Category name"
                    />
                    <button
                      type="button"
                      className={chrome.chip}
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
                    <span className={shell.filterLabel}>{c}</span>
                    <button type="button" className={chrome.chip} onClick={() => { setEditingCategory(c); setEditCategoryName(c); }}>
                      Rename
                    </button>
                    <button
                      type="button"
                      className={chrome.chip}
                      onClick={() => {
                        void (async () => {
                          if (!(await confirmUserAction(`Delete category "${c}"?`))) return;
                          try {
                            await deleteCategory(c);
                            if (category === c) plan.setShoppingCategory('__all__');
                          } catch (err) {
                            window.alert(err instanceof Error ? err.message : 'Could not delete category.');
                          }
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
          </div>
            ) : null}
          </>
        ) : null}
      </div>

      <div>
        <p className={chrome.filterGroupTitle}>Buy by month</p>
        <div className={chrome.chipRow}>
          <button
            type="button"
            className={`${chrome.chip} ${month === null ? chrome.chipActive : ''}`}
            onClick={() => plan.setShoppingMonthFilter(null)}
          >
            All months
          </button>
          <button
            type="button"
            className={`${chrome.chip} ${month === '__unscheduled__' ? chrome.chipActive : ''}`}
            onClick={() => plan.setShoppingMonthFilter('__unscheduled__')}
          >
            Unscheduled
          </button>
        </div>
      </div>
    </div>
  );
};
