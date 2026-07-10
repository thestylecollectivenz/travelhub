import * as React from 'react';
import { useTripWorkspace } from '../../context/TripWorkspaceContext';
import { useSpContext } from '../../context/SpContext';
import { logTripAccessOnce } from '../../services/TripAccessLogService';
import { MobileDayView } from './MobileDayView';
import { MobileJournalView } from './MobileJournalView';
import { MobileListsView } from './MobileListsView';
import { MobileMapView } from './MobileMapView';
import { MobileTaskView } from './MobileTaskView';
import { TripMembersPanel } from '../workspace/TripMembersPanel';
import { AiAssistantFab } from '../workspace/AiAssistantFab';
import type { MobileTab } from './mobileTypes';
import { SOLUTION_VERSION } from '../../appVersion';
import styles from './MobileShell.module.css';

export type { MobileTab } from './mobileTypes';

export interface MobileTripShellProps {
  onBack: () => void;
  initialTab?: MobileTab;
}

const TABS: Array<{ id: MobileTab; label: string; icon: React.ReactNode }> = [
  {
    id: 'today',
    label: 'Itinerary',
    icon: (
      <svg width="20" height="20" viewBox="0 0 20 20" fill="none" aria-hidden>
        <rect x="3" y="5" width="14" height="12" rx="2" stroke="currentColor" strokeWidth="1.5" />
        <path d="M7 3v3M13 3v3" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
        <path d="M6 11h8M6 14h5" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" />
      </svg>
    )
  },
  {
    id: 'journal',
    label: 'Journal',
    icon: (
      <svg width="20" height="20" viewBox="0 0 20 20" fill="none" aria-hidden>
        <rect x="4" y="3" width="12" height="14" rx="2" stroke="currentColor" strokeWidth="1.5" />
        <path d="M7 8h6M7 11h4" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" />
        <circle cx="7" cy="8" r="0.7" fill="currentColor" />
        <circle cx="7" cy="11" r="0.7" fill="currentColor" />
      </svg>
    )
  },
  {
    id: 'lists',
    label: 'Lists',
    icon: (
      <svg width="20" height="20" viewBox="0 0 20 20" fill="none" aria-hidden>
        <rect x="3" y="3" width="6" height="6" rx="1.2" stroke="currentColor" strokeWidth="1.5" />
        <rect x="11" y="3" width="6" height="6" rx="1.2" stroke="currentColor" strokeWidth="1.5" />
        <rect x="3" y="11" width="6" height="6" rx="1.2" stroke="currentColor" strokeWidth="1.5" />
        <rect x="11" y="11" width="6" height="6" rx="1.2" stroke="currentColor" strokeWidth="1.5" />
      </svg>
    )
  },
  {
    id: 'tasks',
    label: 'Tasks',
    icon: (
      <svg width="20" height="20" viewBox="0 0 20 20" fill="none" aria-hidden>
        <path d="M5 10l3 3 7-6" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
        <rect x="3" y="4" width="14" height="12" rx="2" stroke="currentColor" strokeWidth="1.5" />
      </svg>
    )
  },
  {
    id: 'map',
    label: 'Map',
    icon: (
      <svg width="20" height="20" viewBox="0 0 20 20" fill="none" aria-hidden>
        <path d="M10 3C7.24 3 5 5.24 5 8c0 4.25 5 9 5 9s5-4.75 5-9c0-2.76-2.24-5-5-5z" stroke="currentColor" strokeWidth="1.5" />
        <circle cx="10" cy="8" r="1.8" stroke="currentColor" strokeWidth="1.3" />
      </svg>
    )
  }
];

export const MobileTripShell: React.FC<MobileTripShellProps> = ({ onBack, initialTab }) => {
  const { trip } = useTripWorkspace();
  const spContext = useSpContext();
  const [tab, setTab] = React.useState<MobileTab>(initialTab ?? 'today');
  const [membersOpen, setMembersOpen] = React.useState(false);

  React.useEffect(() => {
    if (initialTab) setTab(initialTab);
  }, [initialTab, trip?.id]);

  React.useEffect(() => {
    if (trip?.id) logTripAccessOnce(spContext, trip.id, 'view.mobile', tab);
  }, [trip?.id, tab, spContext]);

  const handleOpenMembers = React.useCallback(() => setMembersOpen(true), []);

  const handleAskAi = React.useCallback((prompt?: string) => {
    window.dispatchEvent(
      new CustomEvent('travelhub-open-ai', { detail: { prompt: prompt ?? '' } })
    );
  }, []);

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
      body = <MobileDayView onOpenMembers={handleOpenMembers} onAskAi={handleAskAi} />;
  }

  return (
    <div className={styles.mobileRoot}>
      <header className={styles.mobileHeader}>
        <button type="button" className={styles.backBtn} onClick={onBack} aria-label="All trips">
          <svg width="16" height="16" viewBox="0 0 16 16" fill="none" style={{ verticalAlign: 'middle', marginRight: 3 }} aria-hidden>
            <path d="M10 3L5 8l5 5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
          All Trips
        </button>
        <h1 className={styles.headerTitle}>{trip?.title ?? 'Trip'}</h1>
        <button
          type="button"
          className={styles.headerIconBtn}
          onClick={handleOpenMembers}
          aria-label="Trip members"
          title="Trip members"
        >
          <svg width="18" height="18" viewBox="0 0 20 20" fill="none" aria-hidden>
            <circle cx="7" cy="6" r="3.5" stroke="currentColor" strokeWidth="1.5" />
            <path d="M1 17c0-3.314 2.686-6 6-6" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
            <circle cx="14" cy="7" r="2.5" stroke="currentColor" strokeWidth="1.5" />
            <path d="M11.5 17c0-2.485 1.567-4.5 3.5-4.5s3.5 2.015 3.5 4.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
          </svg>
        </button>
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
            {t.icon}
            {t.label}
          </button>
        ))}
      </nav>
      {trip?.id ? (
        <TripMembersPanel
          tripId={trip.id}
          isOpen={membersOpen}
          onClose={() => setMembersOpen(false)}
        />
      ) : null}
      <AiAssistantFab />
      <span aria-hidden style={{ display: 'none' }}>v{SOLUTION_VERSION}</span>
    </div>
  );
};
