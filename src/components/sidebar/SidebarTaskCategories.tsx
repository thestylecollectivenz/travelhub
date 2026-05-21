import * as React from 'react';
import { useTripWorkspace } from '../../context/TripWorkspaceContext';
import { usePlanView } from '../../context/PlanViewContext';
import { getCategorySlug } from '../../utils/categoryUtils';
import styles from './TripSidebar.module.css';

export const SidebarTaskCategories: React.FC = () => {
  const { trip, localEntries } = useTripWorkspace();
  const planView = usePlanView();
  const filter = planView?.taskCategoryFilter ?? null;

  const categories = React.useMemo(() => {
    if (!trip) return [];
    const set = new Set<string>();
    for (const e of localEntries) {
      if (e.tripId !== trip.id) continue;
      const c = (e.category || 'Other').trim();
      if (c) set.add(c);
    }
    return Array.from(set).sort((a, b) => a.localeCompare(b));
  }, [localEntries, trip]);

  if (!planView) return null;

  return (
    <div className={styles.dayListSection}>
      <h2 className={styles.dayListHeading}>Filter by category</h2>
      {categories.length === 0 ? (
        <p className={styles.dayListHint}>No itinerary categories yet.</p>
      ) : (
        <ul className={styles.dayList}>
          <li>
            <button
              type="button"
              className={`${styles.packingCatBtn} ${filter === null ? styles.packingCatBtnActive : ''}`}
              onClick={() => planView.setTaskCategoryFilter(null)}
            >
              All categories
            </button>
          </li>
          {categories.map((cat) => {
            const slug = getCategorySlug(cat);
            const active = filter === cat;
            return (
              <li key={cat}>
                <button
                  type="button"
                  className={`${styles.packingCatBtn} th-cat-${slug} ${active ? styles.packingCatBtnActive : ''}`}
                  onClick={() => planView.setTaskCategoryFilter(cat)}
                >
                  {cat}
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
};
