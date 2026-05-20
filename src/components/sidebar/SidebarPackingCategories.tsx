import * as React from 'react';
import { usePlanView } from '../../context/PlanViewContext';
import styles from './TripSidebar.module.css';

const CATEGORIES = ['Clothing', 'Toiletries', 'Electronics', 'Documents', 'Medications', 'Other'];

export const SidebarPackingCategories: React.FC = () => {
  const plan = usePlanView();
  const selected = plan?.packingCategory ?? 'Other';

  return (
    <div className={styles.dayListSection}>
      <h2 className={styles.dayListHeading}>Categories</h2>
      <ul className={styles.dayList}>
        {CATEGORIES.map((c) => (
          <li key={c}>
            <button
              type="button"
              className={`${styles.packingCatBtn} ${selected === c ? styles.packingCatBtnActive : ''}`}
              onClick={() => plan?.setPackingCategory(c)}
            >
              {c}
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
};
