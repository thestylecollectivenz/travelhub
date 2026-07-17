import * as React from 'react';
import { usePlanView } from '../../context/PlanViewContext';
import { useTripWorkspace } from '../../context/TripWorkspaceContext';
import { useSpContext } from '../../context/SpContext';
import { useTripShoppingCategories } from '../../hooks/useTripShoppingCategories';
import { useTripPermissions } from '../../hooks/useTripPermissions';
import { confirmUserAction } from '../../utils/confirmAction';
import chrome from './MobileTabChrome.module.css';
import shell from './MobileShell.module.css';

export interface MobilePackingFiltersProps {
  travellers: string[];
}

/** Traveller + shared category filters for mobile packing list. */
export const MobilePackingFilters: React.FC<MobilePackingFiltersProps> = ({ travellers }) => {
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

  const traveller = plan.packingTraveller ?? null;
  const category = plan.packingCategory ?? '__all__';

  return (
    <div className={chrome.filterPanel}>
      <div>
        <p className={chrome.filterGroupTitle}>Assigned to</p>
        <div className={chrome.chipRow}>
          <button
            type="button"
            className={`${chrome.chip} ${traveller === null ? chrome.chipActive : ''}`}
            onClick={() => plan.setPackingTraveller(null)}
          >
            All
          </button>
          {travellers.map((name) => (
            <button
              key={name}
              type="button"
              className={`${chrome.chip} ${traveller === name ? chrome.chipActive : ''}`}
              onClick={() => plan.setPackingTraveller(name)}
            >
              {name}
            </button>
          ))}
        </div>
      </div>
      <div>
        <p className={chrome.filterGroupTitle}>Category</p>
        <div className={chrome.chipRow}>
          <button
            type="button"
            className={`${chrome.chip} ${category === '__all__' ? chrome.chipActive : ''}`}
            onClick={() => plan.setPackingCategory('__all__')}
          >
            All items
          </button>
          {categories.map((c) => (
            <button
              key={c}
              type="button"
              className={`${chrome.chip} ${category === c ? chrome.chipActive : ''}`}
              onClick={() => plan.setPackingCategory(c)}
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
                plan.setPackingCategory(next);
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
                plan.setPackingCategory(next);
              }}
            >
              Add
            </button>
          </div>
        ) : null}
        {canManageTrip && categories.length > 0 ? (
          <>
            <button type="button" className={chrome.chip} onClick={() => setManageOpen((v) => !v)}>
              {manageOpen ? 'Hide category manager' : 'Manage categories'}
            </button>
            {manageOpen ? (
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
                              if (category === c) plan.setPackingCategory(next);
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
                        <button
                          type="button"
                          className={chrome.chip}
                          onClick={() => {
                            setEditingCategory(c);
                            setEditCategoryName(c);
                          }}
                        >
                          Rename
                        </button>
                        <button
                          type="button"
                          className={chrome.chip}
                          onClick={() => {
                            void (async () => {
                              if (!(await confirmUserAction(`Delete category "${c}"?`))) return;
                              await deleteCategory(c);
                              if (category === c) plan.setPackingCategory('__all__');
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
