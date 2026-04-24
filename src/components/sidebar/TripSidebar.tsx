import * as React from 'react';
import { useTripWorkspace } from '../../context/TripWorkspaceContext';
import { SidebarCategoryBudget } from './SidebarCategoryBudget';
import { SidebarDayList } from './SidebarDayList';
import { SharedSidebarDayList } from './SharedSidebarDayList';
import styles from './TripSidebar.module.css';

export const TripSidebar: React.FC = () => {
  const { sharedPreview, mainWorkspaceTab, setMainWorkspaceTab } = useTripWorkspace();

  if (sharedPreview) {
    return (
      <div className={styles.root}>
        <SharedSidebarDayList />
      </div>
    );
  }

  return (
    <div className={styles.root}>
      <div className={styles.navTabs} role="tablist" aria-label="Main workspace">
        <button
          type="button"
          role="tab"
          aria-selected={mainWorkspaceTab === 'itinerary'}
          className={`${styles.tab} ${mainWorkspaceTab === 'itinerary' ? styles.tabActive : ''}`}
          onClick={() => setMainWorkspaceTab('itinerary')}
        >
          Itinerary
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={mainWorkspaceTab === 'journal'}
          className={`${styles.tab} ${mainWorkspaceTab === 'journal' ? styles.tabActive : ''}`}
          onClick={() => setMainWorkspaceTab('journal')}
        >
          Journal
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={mainWorkspaceTab === 'photos'}
          className={`${styles.tab} ${mainWorkspaceTab === 'photos' ? styles.tabActive : ''}`}
          onClick={() => setMainWorkspaceTab('photos')}
        >
          Photos
        </button>
      </div>
      {mainWorkspaceTab === 'itinerary' ? <SidebarDayList /> : null}
      <div className={styles.divider} role="presentation" />
      <SidebarCategoryBudget />
    </div>
  );
};
