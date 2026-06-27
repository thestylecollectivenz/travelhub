import * as React from 'react';
import { PlanViewProvider } from '../../context/PlanViewContext';
import { PackingListView } from '../packing/PackingListView';
import { ShoppingListView } from '../shopping/ShoppingListView';
import styles from './MobileShell.module.css';

export const MobileListsView: React.FC = () => {
  const [sub, setSub] = React.useState<'packing' | 'shopping'>('packing');

  return (
    <PlanViewProvider>
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
      {sub === 'packing' ? <PackingListView /> : <ShoppingListView />}
    </PlanViewProvider>
  );
};
