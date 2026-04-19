import * as React from 'react';
import { SidebarCategoryBudget } from './SidebarCategoryBudget';
import { SidebarDayList } from './SidebarDayList';
import styles from './TripSidebar.module.css';

export const TripSidebar: React.FC = () => {
  return (
    <div className={styles.root}>
      <SidebarDayList />
      <div className={styles.divider} role="presentation" />
      <SidebarCategoryBudget />
    </div>
  );
};
