import * as React from 'react';
import { useTripWorkspace } from '../../context/TripWorkspaceContext';
import { MobileDayView } from './MobileDayView';
import { MobileJournalView } from './MobileJournalView';
import { MobileListsView } from './MobileListsView';
import { MobileMapView } from './MobileMapView';
import { MobileTaskView } from './MobileTaskView';
import { SOLUTION_VERSION } from '../../appVersion';
import styles from './MobileShell.module.css';

export type MobileTab = 'today' | 'journal' | 'lists' | 'map' | 'tasks';

export interface MobileTripShellProps {
  onBack: () => void;
}

const TABS: Array<{ id: MobileTab; label: string }> = [
  { id: 'today', label: 'Today' },
  { id: 'journal', label: 'Journal' },
  { id: 'lists', label: 'Lists' },
  { id: 'map', label: 'Map' },
  { id: 'tasks', label: 'Tasks' }
];

export const MobileTripShell: React.FC<MobileTripShellProps> = ({ onBack }) => {
  const { trip } = useTripWorkspace();
  const [tab, setTab] = React.useState<MobileTab>('today');

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
