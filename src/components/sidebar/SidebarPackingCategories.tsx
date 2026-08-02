import * as React from 'react';
import { usePlanView } from '../../context/PlanViewContext';
import { useTripWorkspace } from '../../context/TripWorkspaceContext';
import { useSpContext } from '../../context/SpContext';
import { useTripShoppingCategories } from '../../hooks/useTripShoppingCategories';
import { useTripMembers } from '../../hooks/useTripMembers';
import { isAllCategories } from '../../utils/multiSelectFilters';
import styles from './TripSidebar.module.css';

/** Traveller filters for packing — Editors/Companions only (via useTripMembers). */
export const SidebarPackingCategories: React.FC = () => {
  const plan = usePlanView();
  const { trip } = useTripWorkspace();
  const spContext = useSpContext();
  const { categories } = useTripShoppingCategories(trip?.id, spContext);
  const { travellers } = useTripMembers(trip?.id);
  const selected = plan?.packingCategories ?? [];
  const traveller = plan?.packingTraveller ?? null;

  if (!plan) return null;

  return (
    <div className={styles.dayListSection}>
      <h2 className={styles.dayListHeading}>Travellers</h2>
      <p className={styles.dayListHint}>
        Select a traveller to filter the list. New items use your journal display name (or the selected traveller).
        Followers are not listed.
      </p>
      <ul className={styles.dayList}>
        <li>
          <button
            type="button"
            className={`${styles.packingCatBtn} ${traveller === null ? styles.packingCatBtnActive : ''}`}
            onClick={() => plan.setPackingTraveller(null)}
          >
            All travellers
          </button>
        </li>
        {travellers.map((name) => (
          <li key={name}>
            <button
              type="button"
              className={`${styles.packingCatBtn} ${traveller === name ? styles.packingCatBtnActive : ''}`}
              onClick={() => plan.setPackingTraveller(name)}
            >
              {name}
            </button>
          </li>
        ))}
      </ul>

      <h2 className={styles.dayListHeading}>Categories</h2>
      <ul className={styles.dayList}>
        <li>
          <button
            type="button"
            className={`${styles.packingCatBtn} ${isAllCategories(selected) ? styles.packingCatBtnActive : ''}`}
            onClick={() => plan.setPackingCategories([])}
          >
            All categories
          </button>
        </li>
        {categories.map((cat) => (
          <li key={cat}>
            <button
              type="button"
              className={`${styles.packingCatBtn} ${selected.indexOf(cat) >= 0 ? styles.packingCatBtnActive : ''}`}
              onClick={() => plan.setPackingCategories([cat])}
            >
              {cat}
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
};
