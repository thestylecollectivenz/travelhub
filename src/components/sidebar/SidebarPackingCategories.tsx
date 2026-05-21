import * as React from 'react';
import { usePlanView } from '../../context/PlanViewContext';
import { useTripWorkspace } from '../../context/TripWorkspaceContext';
import { loadTripTravellers } from '../../utils/tripTravellers';
import styles from './TripSidebar.module.css';

const CATEGORIES = ['Clothing', 'Toiletries', 'Electronics', 'Documents', 'Medications', 'Other'];

export const SidebarPackingCategories: React.FC = () => {
  const plan = usePlanView();
  const { trip } = useTripWorkspace();
  const selected = plan?.packingCategory ?? 'Other';
  const traveller = plan?.packingTraveller ?? null;

  const travellers = React.useMemo(() => (trip?.id ? loadTripTravellers(trip.id) : ['Traveller 1']), [trip?.id]);

  if (!plan) return null;

  return (
    <div className={styles.dayListSection}>
      <h2 className={styles.dayListHeading}>Packing list</h2>
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
      <h2 className={styles.dayListHeading}>Category</h2>
      <ul className={styles.dayList}>
        <li>
          <button
            type="button"
            className={`${styles.packingCatBtn} ${selected === '__all__' ? styles.packingCatBtnActive : ''}`}
            onClick={() => plan.setPackingCategory('__all__')}
          >
            All items
          </button>
        </li>
        {CATEGORIES.map((c) => (
          <li key={c}>
            <button
              type="button"
              className={`${styles.packingCatBtn} ${selected === c ? styles.packingCatBtnActive : ''}`}
              onClick={() => plan.setPackingCategory(c)}
            >
              {c}
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
};
