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
  const itineraryIcon = (
    <svg viewBox="0 0 16 16" width={18} height={18} fill="none" aria-hidden>
      <path d="M3 3.5h10M3 8h10M3 12.5h10" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
      <circle cx="2.2" cy="3.5" r=".8" fill="currentColor" />
      <circle cx="2.2" cy="8" r=".8" fill="currentColor" />
      <circle cx="2.2" cy="12.5" r=".8" fill="currentColor" />
    </svg>
  );
  const mapIcon = (
    <svg viewBox="0 0 16 16" width={18} height={18} fill="none" aria-hidden>
      <path d="M8 14s4.5-2.8 4.5-6.4A4.5 4.5 0 1 0 3.5 7.6C3.5 11.2 8 14 8 14Z" stroke="currentColor" strokeWidth="1.2" />
      <circle cx="8" cy="7.2" r="1.5" fill="currentColor" />
    </svg>
  );
  const journalIcon = (
    <svg viewBox="0 0 16 16" width={18} height={18} fill="none" aria-hidden>
      <path d="M3 2.8h6.8a2 2 0 0 1 2 2V13H5a2 2 0 0 0-2 2V2.8Z" stroke="currentColor" strokeWidth="1.2" />
      <path d="M5.6 5.6h4.4M5.6 8h3.6" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" />
      <path d="m10.5 10.8 2.2-2.2 1 .9-2.2 2.2-1.4.4.4-1.3Z" fill="currentColor" />
    </svg>
  );
  const photosIcon = (
    <svg viewBox="0 0 16 16" width={18} height={18} fill="none" aria-hidden>
      <rect x="2" y="3" width="12" height="10" rx="1.6" stroke="currentColor" strokeWidth="1.2" />
      <circle cx="6" cy="6.8" r="1.2" fill="currentColor" />
      <path d="m3.6 11 2.8-2.8 2.2 1.9 2.3-2.2 1.5 3.1" stroke="currentColor" strokeWidth="1.1" strokeLinecap="round" />
    </svg>
  );
  const filesIcon = (
    <svg viewBox="0 0 16 16" width={18} height={18} fill="none" aria-hidden>
      <path d="M6.2 8.2 9.8 4.6a2 2 0 1 1 2.8 2.8L8.2 11.8a3 3 0 0 1-4.2-4.2L8 3.6" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" />
    </svg>
  );
  const planIcon = (
    <svg viewBox="0 0 16 16" width={18} height={18} fill="none" aria-hidden>
      <rect x="2.2" y="2.5" width="11.6" height="11" rx="1.8" stroke="currentColor" strokeWidth="1.2" />
      <path d="m5.1 6.4 1.4 1.4 3-3" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M5.2 10.4h5.5" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" />
    </svg>
  );

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
            title="Map"
            aria-label="Map"
          >
            {mapIcon}
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={mainWorkspaceTab === 'files'}
            className={`${styles.tab} ${mainWorkspaceTab === 'files' ? styles.tabActive : ''}`}
            onClick={() => setMainWorkspaceTab('files')}
            title="Files"
            aria-label="Files"
          >
            {filesIcon}
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={mainWorkspaceTab === 'itinerary'}
            className={`${styles.tab} ${mainWorkspaceTab === 'itinerary' ? styles.tabActive : ''}`}
            onClick={() => setMainWorkspaceTab('itinerary')}
            title="Itinerary"
            aria-label="Itinerary"
          >
            {itineraryIcon}
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={mainWorkspaceTab === 'journal'}
            className={`${styles.tab} ${mainWorkspaceTab === 'journal' ? styles.tabActive : ''}`}
            onClick={() => setMainWorkspaceTab('journal')}
            title="Journal"
            aria-label="Journal"
          >
            {journalIcon}
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={mainWorkspaceTab === 'photos'}
            className={`${styles.tab} ${mainWorkspaceTab === 'photos' ? styles.tabActive : ''}`}
            onClick={() => setMainWorkspaceTab('photos')}
            title="Photos"
            aria-label="Photos"
          >
            {photosIcon}
          </button>
        </div>
        <div className={styles.sidebarBodyScroll}>
          {mainWorkspaceTab === 'itinerary' ? <SharedSidebarDayList /> : null}
        </div>
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
          title="Itinerary"
          aria-label="Itinerary"
        >
          {itineraryIcon}
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={mainWorkspaceTab === 'map'}
          className={`${styles.tab} ${mainWorkspaceTab === 'map' ? styles.tabActive : ''}`}
          onClick={() => setMainWorkspaceTab('map')}
          title="Map"
          aria-label="Map"
        >
          {mapIcon}
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={mainWorkspaceTab === 'journal'}
          className={`${styles.tab} ${mainWorkspaceTab === 'journal' ? styles.tabActive : ''}`}
          onClick={() => setMainWorkspaceTab('journal')}
          title="Journal"
          aria-label="Journal"
        >
          {journalIcon}
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={mainWorkspaceTab === 'photos'}
          className={`${styles.tab} ${mainWorkspaceTab === 'photos' ? styles.tabActive : ''}`}
          onClick={() => setMainWorkspaceTab('photos')}
          title="Photos"
          aria-label="Photos"
        >
          {photosIcon}
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={mainWorkspaceTab === 'files'}
          className={`${styles.tab} ${mainWorkspaceTab === 'files' ? styles.tabActive : ''}`}
          onClick={() => setMainWorkspaceTab('files')}
          title="Files"
          aria-label="Files"
        >
          {filesIcon}
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={mainWorkspaceTab === 'plan'}
          className={`${styles.tab} ${mainWorkspaceTab === 'plan' ? styles.tabActive : ''}`}
          onClick={() => setMainWorkspaceTab('plan')}
          title={taskCount > 0 ? `Plan (${taskCount})` : 'Plan'}
          aria-label={taskCount > 0 ? `Plan (${taskCount})` : 'Plan'}
        >
          {planIcon}
        </button>
      </div>
      <div className={styles.sidebarBodyScroll}>
        {mainWorkspaceTab === 'itinerary' ? <SidebarDayList /> : null}
      </div>
      <div className={styles.divider} role="presentation" />
      <SidebarCategoryBudget />
    </div>
  );
};
