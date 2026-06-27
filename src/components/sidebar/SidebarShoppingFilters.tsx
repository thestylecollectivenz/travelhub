import * as React from 'react';
import { usePlanView } from '../../context/PlanViewContext';
import { useTripWorkspace } from '../../context/TripWorkspaceContext';
import { loadTripTravellers } from '../../utils/tripTravellers';
import { loadTripShoppingCategories } from '../../utils/tripShoppingCategories';
import styles from './TripSidebar.module.css';

export const SidebarShoppingFilters: React.FC = () => {
  const plan = usePlanView();
  const { trip } = useTripWorkspace();
  const travellers = React.useMemo(() => (trip?.id ? loadTripTravellers(trip.id) : ['Traveller 1']), [trip?.id]);
  const categories = React.useMemo(() => (trip?.id ? loadTripShoppingCategories(trip.id) : ['Other']), [trip?.id]);
  const traveller = plan?.shoppingTraveller ?? null;
  const category = plan?.shoppingCategory ?? '__all__';

  return (
    <div className={styles.dayListSection}>
      <h2 className={styles.dayListHeading}>Traveller</h2>
      <div className={styles.travellerRow}>
        <button
          type="button"
          className={`${styles.packingCatBtn} ${traveller === null ? styles.packingCatBtnActive : ''}`}
          onClick={() => plan?.setShoppingTraveller(null)}
        >
          All
        </button>
        {travellers.map((name) => (
          <button
            key={name}
            type="button"
            className={`${styles.packingCatBtn} ${traveller === name ? styles.packingCatBtnActive : ''}`}
            onClick={() => plan?.setShoppingTraveller(name)}
          >
            {name}
          </button>
        ))}
      </div>

      <h2 className={styles.dayListHeading}>Category</h2>
      <button
        type="button"
        className={`${styles.packingCatBtn} ${category === '__all__' ? styles.packingCatBtnActive : ''}`}
        onClick={() => plan?.setShoppingCategory('__all__')}
      >
        All categories
      </button>
      {categories.map((c) => (
        <button
          key={c}
          type="button"
          className={`${styles.packingCatBtn} ${category === c ? styles.packingCatBtnActive : ''}`}
          onClick={() => plan?.setShoppingCategory(c)}
        >
          {c}
        </button>
      ))}

      {plan?.shoppingMonthFilter ? (
        <p className={styles.dayListHint}>
          Month filter: {plan.shoppingMonthFilter}{' '}
          <button type="button" className={styles.packingCatBtn} onClick={() => plan.setShoppingMonthFilter(null)}>
            Clear
          </button>
        </p>
      ) : null}
    </div>
  );
};
