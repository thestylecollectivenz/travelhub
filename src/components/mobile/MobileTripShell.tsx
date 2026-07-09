import * as React from 'react';
import { useTripWorkspace } from '../../context/TripWorkspaceContext';
import { useSpContext } from '../../context/SpContext';
import { logTripAccessOnce } from '../../services/TripAccessLogService';
import { MobileDayView } from './MobileDayView';
import { MobileJournalView } from './MobileJournalView';
import { MobileListsView } from './MobileListsView';
import { MobileMapView } from './MobileMapView';
import { MobileTaskView } from './MobileTaskView';
import type { MobileTab } from './mobileTypes';
import { SOLUTION_VERSION } from '../../appVersion';
import styles from './MobileShell.module.css';

export type { MobileTab } from './mobileTypes';

export interface MobileTripShellProps {
  onBack: () => void;
  initialTab?: MobileTab;
}

const TABS: Array<{ id: MobileTab; label: string }> = [
  { id: 'today', label: 'Itinerary' },
  { id: 'journal', label: 'Journal' },
  { id: 'lists', label: 'Lists' },
  { id: 'tasks', label: 'Tasks' },
  { id: 'map', label: 'Map' }
];

export const MobileTripShell: React.FC<MobileTripShellProps> = ({ onBack, initialTab }) => {
  const { trip } = useTripWorkspace();
  const spContext = useSpContext();
  const [tab, setTab] = React.useState<MobileTab>(initialTab ?? 'today');

  React.useEffect(() => {
    if (initialTab) setTab(initialTab);
  }, [initialTab, trip?.id]);

  React.useEffect(() => {
    if (trip?.id) logTripAccessOnce(spContext, trip.id, 'view.mobile', tab);
  }, [trip?.id, tab, spContext]);

  let body: React.ReactNode;
  switch (tab) {
    case 'journal':
      body = <MobileJournalView />;
      break;
    case 'lists':
      body = <MobileListsView />;
      break;
    case 'map':
      body = <MobileMapView />;
      break;
    case 'tasks':
      body = <MobileTaskView />;
      break;
    default:
      body = <MobileDayView />;
  }

  return (
    <div className={styles.mobileRoot}>
      <header className={styles.mobileHeader}>
        <button type="button" className={styles.backBtn} onClick={onBack}>
          ← Trips
        </button>
        <h1 className={styles.headerTitle}>{trip?.title ?? 'Trip'}</h1>
        <span className={styles.muted}>v{SOLUTION_VERSION}</span>
      </header>
      <main className={styles.mobileMain}>{body}</main>
      <nav className={styles.tabBar} aria-label="Mobile trip navigation">
        {TABS.map((t) => (
          <button
            key={t.id}
            type="button"
            className={`${styles.tabBtn} ${tab === t.id ? styles.tabBtnActive : ''}`}
            onClick={() => setTab(t.id)}
          >
            {t.label}
          </button>
        ))}
      </nav>
    </div>
  );
};
