import * as React from 'react';
import { PlanViewProvider } from '../../context/PlanViewContext';
import { MobilePackingList } from './MobilePackingList';
import { MobileShoppingList } from './MobileShoppingList';
import { MobileShoppingFilters } from './MobileShoppingFilters';
import { useTripMembers } from '../../hooks/useTripMembers';
import { useTripWorkspace } from '../../context/TripWorkspaceContext';
import { useTripRole } from '../../context/TripRoleContext';
import { useCompanionListDefaults } from '../../hooks/useCompanionListDefaults';
import { usePlanView } from '../../context/PlanViewContext';
import styles from './MobileShell.module.css';

const MobileListsBody: React.FC = () => {
  const [sub, setSub] = React.useState<'packing' | 'shopping'>('packing');
  const { trip } = useTripWorkspace();
  const planView = usePlanView();
  const { role } = useTripRole();
  const { members, travellers } = useTripMembers(trip?.id);
  useCompanionListDefaults(planView, role, members);

  return (
    <div className={styles.mobileListsWrap}>
      <div className={styles.subTabs}>
        <button
          type="button"
          className={`${styles.pagerBtn} ${sub === 'packing' ? styles.pagerBtnActive : ''}`}
          onClick={() => setSub('packing')}
        >
          Packing
        </button>
        <button
          type="button"
          className={`${styles.pagerBtn} ${sub === 'shopping' ? styles.pagerBtnActive : ''}`}
          onClick={() => setSub('shopping')}
        >
          Shopping
        </button>
      </div>
      {sub === 'shopping' ? <MobileShoppingFilters travellers={travellers} /> : null}
      {sub === 'packing' ? <MobilePackingList /> : <MobileShoppingList />}
    </div>
  );
};

export const MobileListsView: React.FC = () => {
  return (
    <PlanViewProvider>
      <MobileListsBody />
    </PlanViewProvider>
  );
};
