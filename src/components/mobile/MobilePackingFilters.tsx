import * as React from 'react';
import { usePlanView } from '../../context/PlanViewContext';
import chrome from './MobileTabChrome.module.css';

const CATEGORIES = ['Clothing', 'Toiletries', 'Electronics', 'Documents', 'Medications', 'Other'];

export interface MobilePackingFiltersProps {
  travellers: string[];
}

/** Traveller + category filters for mobile packing list (mirrors desktop sidebar). */
export const MobilePackingFilters: React.FC<MobilePackingFiltersProps> = ({ travellers }) => {
  const plan = usePlanView();
  if (!plan) return null;

  const traveller = plan.packingTraveller ?? null;
  const category = plan.packingCategory ?? 'Other';

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
          {CATEGORIES.map((c) => (
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
      </div>
    </div>
  );
};
