import * as React from 'react';
import { useTripWorkspace } from '../../context/TripWorkspaceContext';
import { useSpContext } from '../../context/SpContext';
import { ReminderService } from '../../services/ReminderService';
import { SidebarCategoryBudget } from './SidebarCategoryBudget';
import { SidebarDayList } from './SidebarDayList';
import { SharedSidebarDayList } from './SharedSidebarDayList';
import styles from './TripSidebar.module.css';

export const TripSidebar: React.FC = () => {
  const spContext = useSpContext();
  const { sharedPreview, mainWorkspaceTab, setMainWorkspaceTab, trip, localEntries } = useTripWorkspace();
  const [manualIncomplete, setManualIncomplete] = React.useState(0);
  React.useEffect(() => {
    if (!trip?.id) {
      setManualIncomplete(0);
      return;
    }
    const svc = new ReminderService(spContext);
    svc.getForTrip(trip.id).then((rows) => setManualIncomplete(rows.filter((r) => !r.isComplete).length)).catch(() => setManualIncomplete(0));
  }, [spContext, trip?.id]);
  const autoIncomplete = React.useMemo(
    () => localEntries.filter((e) => (e.bookingRequired && e.bookingStatus === 'Not booked') || (e.paymentStatus === 'Not paid' && e.amount > 0) || e.paymentStatus === 'Part paid').length,
    [localEntries]
  );
  const taskCount = manualIncomplete + autoIncomplete;

  if (sharedPreview) {
    return (
      <div className={styles.root}>
        <div className={styles.navTabs} role="tablist" aria-label="Main workspace">
          <button
            type="button"
            role="tab"
            aria-selected={mainWorkspaceTab === 'map'}
            className={`${styles.tab} ${mainWorkspaceTab === 'map' ? styles.tabActive : ''}`}
            onClick={() => setMainWorkspaceTab('map')}
          >
            Map
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={mainWorkspaceTab === 'files'}
            className={`${styles.tab} ${mainWorkspaceTab === 'files' ? styles.tabActive : ''}`}
            onClick={() => setMainWorkspaceTab('files')}
          >
            Links
          </button>
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
        {mainWorkspaceTab === 'itinerary' ? <SharedSidebarDayList /> : null}
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
          aria-selected={mainWorkspaceTab === 'map'}
          className={`${styles.tab} ${mainWorkspaceTab === 'map' ? styles.tabActive : ''}`}
          onClick={() => setMainWorkspaceTab('map')}
        >
          Map
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
        <button
          type="button"
          role="tab"
          aria-selected={mainWorkspaceTab === 'files'}
          className={`${styles.tab} ${mainWorkspaceTab === 'files' ? styles.tabActive : ''}`}
          onClick={() => setMainWorkspaceTab('files')}
        >
          Files & Links
        </button>
        <button type="button" role="tab" aria-selected={mainWorkspaceTab === 'tasks'} className={`${styles.tab} ${mainWorkspaceTab === 'tasks' ? styles.tabActive : ''}`} onClick={() => setMainWorkspaceTab('tasks')}>Tasks{taskCount > 0 ? ` (${taskCount})` : ''}</button>
        <button type="button" role="tab" aria-selected={mainWorkspaceTab === 'packing'} className={`${styles.tab} ${mainWorkspaceTab === 'packing' ? styles.tabActive : ''}`} onClick={() => setMainWorkspaceTab('packing')}>Packing</button>
      </div>
      {mainWorkspaceTab === 'itinerary' ? <SidebarDayList /> : null}
      <div className={styles.divider} role="presentation" />
      <SidebarCategoryBudget />
    </div>
  );
};
