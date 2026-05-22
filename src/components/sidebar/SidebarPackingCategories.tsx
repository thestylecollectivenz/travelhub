import * as React from 'react';
import { usePlanView } from '../../context/PlanViewContext';
import { useTripWorkspace } from '../../context/TripWorkspaceContext';
import { loadTripTravellers, saveTripTravellers } from '../../utils/tripTravellers';
import styles from './TripSidebar.module.css';

const CATEGORIES = ['Clothing', 'Toiletries', 'Electronics', 'Documents', 'Medications', 'Other'];

export const SidebarPackingCategories: React.FC = () => {
  const plan = usePlanView();
  const { trip } = useTripWorkspace();
  const selected = plan?.packingCategory ?? 'Other';
  const traveller = plan?.packingTraveller ?? null;
  const [travellers, setTravellers] = React.useState<string[]>(['Traveller 1']);
  const [newTravellerName, setNewTravellerName] = React.useState('');
  const [editingTraveller, setEditingTraveller] = React.useState<string | null>(null);
  const [editName, setEditName] = React.useState('');

  React.useEffect(() => {
    if (trip?.id) setTravellers(loadTripTravellers(trip.id));
  }, [trip?.id]);

  const persistTravellers = React.useCallback(
    (names: string[]) => {
      if (!trip?.id) return;
      saveTripTravellers(trip.id, names);
      setTravellers(names);
    },
    [trip?.id]
  );

  if (!plan) return null;

  return (
    <div className={styles.dayListSection}>
      <h2 className={styles.dayListHeading}>Travellers</h2>
      <p className={styles.dayListHint}>
        Select a traveller to filter the list. New items are assigned to the selected traveller (or the first traveller when viewing all).
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
            {editingTraveller === name ? (
              <div className={styles.travellerEditRow}>
                <input
                  className={styles.travellerInput}
                  value={editName}
                  onChange={(e) => setEditName(e.target.value)}
                  aria-label="Traveller name"
                />
                <button
                  type="button"
                  className={styles.travellerActionBtn}
                  onClick={() => {
                    const next = editName.trim();
                    if (!next) return;
                    const updated = travellers.map((t) => (t === name ? next : t));
                    persistTravellers(updated);
                    if (traveller === name) plan.setPackingTraveller(next);
                    setEditingTraveller(null);
                  }}
                >
                  Save
                </button>
              </div>
            ) : (
              <div className={styles.travellerRow}>
                <button
                  type="button"
                  className={`${styles.packingCatBtn} ${traveller === name ? styles.packingCatBtnActive : ''}`}
                  onClick={() => plan.setPackingTraveller(name)}
                >
                  {name}
                </button>
                <button
                  type="button"
                  className={styles.travellerActionBtn}
                  title="Rename traveller"
                  onClick={() => {
                    setEditingTraveller(name);
                    setEditName(name);
                  }}
                >
                  ✎
                </button>
              </div>
            )}
          </li>
        ))}
      </ul>
      <div className={styles.travellerAddRow}>
        <input
          className={styles.travellerInput}
          placeholder="Add traveller name"
          value={newTravellerName}
          onChange={(e) => setNewTravellerName(e.target.value)}
        />
        <button
          type="button"
          className={styles.travellerActionBtn}
          onClick={() => {
            const next = newTravellerName.trim();
            if (!next || travellers.some((t) => t.toLowerCase() === next.toLowerCase())) return;
            persistTravellers([...travellers, next]);
            setNewTravellerName('');
            plan.setPackingTraveller(next);
          }}
        >
          Add
        </button>
      </div>
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
