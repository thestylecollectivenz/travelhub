import * as React from 'react';
import { useTripWorkspace } from '../../context/TripWorkspaceContext';
import { useSpContext } from '../../context/SpContext';
import { useTripPermissions } from '../../hooks/useTripPermissions';
import { logTripAccessOnce } from '../../services/TripAccessLogService';
import { ItineraryService } from '../../services/ItineraryService';
import { MobileDayView } from './MobileDayView';
import { MobileJournalView } from './MobileJournalView';
import { MobileListsView } from './MobileListsView';
import { MobileMapView } from './MobileMapView';
import { MobileTaskView } from './MobileTaskView';
import { TripMembersPanel } from '../workspace/TripMembersPanel';
import { AiAssistantFab } from '../workspace/AiAssistantFab';
import { MobileAskAiResultsSheet } from './MobileAskAiResultsSheet';
import type { MobileTab } from './mobileTypes';
import type { ShellMode } from '../../hooks/useShellMode';
import { SOLUTION_VERSION } from '../../appVersion';
import styles from './MobileShell.module.css';

export type { MobileTab } from './mobileTypes';

export interface MobileTripShellProps {
  onBack: () => void;
  initialTab?: MobileTab;
  shellMode?: Extract<ShellMode, 'phone' | 'ipad-portrait'>;
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

export const MobileTripShell: React.FC<MobileTripShellProps> = ({ onBack, initialTab, shellMode = 'phone' }) => {
  const { trip, tripDays, selectedDayId, reloadItineraryEntries } = useTripWorkspace();
  const spContext = useSpContext();
  const { canUseAiHelpers, canEditItinerary } = useTripPermissions();
  const [tab, setTab] = React.useState<MobileTab>(initialTab ?? 'today');
  const [membersOpen, setMembersOpen] = React.useState(false);
  const [askAiPrompt, setAskAiPrompt] = React.useState<string | null>(null);
  const [cardDetailOpen, setCardDetailOpen] = React.useState(false);
  const closeCardDetailRef = React.useRef<(() => void) | undefined>(undefined);

  React.useEffect(() => {
    if (initialTab) setTab(initialTab);
  }, [initialTab, trip?.id]);

  React.useEffect(() => {
    if (trip?.id) logTripAccessOnce(spContext, trip.id, 'view.mobile', tab);
  }, [trip?.id, tab, spContext]);

  const handleOpenMembers = React.useCallback(() => setMembersOpen(true), []);

  const handleAskAi = React.useCallback((prompt?: string) => {
    const p = (prompt ?? '').trim();
    if (!p) return;
    setAskAiPrompt(p);
  }, []);

  const handleDetailChange = React.useCallback((open: boolean, close?: () => void) => {
    setCardDetailOpen(open);
    closeCardDetailRef.current = close;
  }, []);

  const saveNearPlace = React.useCallback((place: { name: string; note?: string; mapsUrl?: string }): void => {
    try {
      const key = 'travelhub-near-you-saved';
      const raw = window.localStorage.getItem(key);
      const prev = raw ? (JSON.parse(raw) as unknown[]) : [];
      const list = Array.isArray(prev) ? prev : [];
      list.unshift({ ...place, savedAt: new Date().toISOString() });
      window.localStorage.setItem(key, JSON.stringify(list.slice(0, 40)));
    } catch {
      /* device storage unavailable */
    }
  }, []);

  const addNearToItinerary = React.useCallback(
    async (place: { name: string; note?: string; mapsUrl?: string; websiteUrl?: string }): Promise<void> => {
      if (!trip) return;
      const day = tripDays.find((d) => d.id === selectedDayId) ?? tripDays[0];
      if (!day) return;
      const itin = new ItineraryService(spContext);
      await itin.create({
        tripId: trip.id,
        dayId: day.id,
        title: place.name,
        category: 'Activities',
        location: place.note || '',
        timeStart: '',
        duration: '',
        supplier: '',
        notes: place.mapsUrl ? `Maps: ${place.mapsUrl}` : '',
        decisionStatus: 'Idea',
        bookingRequired: false,
        bookingStatus: 'Not booked',
        paymentStatus: 'Not paid',
        amount: 0,
        currency: 'NZD',
        sortOrder: 999
      });
      await reloadItineraryEntries();
    },
    [trip, tripDays, selectedDayId, spContext, reloadItineraryEntries]
  );

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
      body = <MobileDayView onOpenMembers={handleOpenMembers} onAskAi={handleAskAi} onDetailChange={handleDetailChange} />;
  }

  return (
    <div
      className={styles.mobileRoot}
      data-shell={shellMode === 'ipad-portrait' ? 'ipad-portrait' : undefined}
    >
      <header className={styles.mobileHeader}>
        <div className={styles.headerStart}>
        {cardDetailOpen && tab === 'today' ? (
          <button
            type="button"
            className={styles.backBtn}
            onClick={() => closeCardDetailRef.current?.()}
            aria-label="Back to day"
          >
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none" style={{ verticalAlign: 'middle', marginRight: 3 }} aria-hidden>
              <path d="M10 3L5 8l5 5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
            Back
          </button>
        ) : tab === 'today' ? (
          <button type="button" className={styles.backBtn} onClick={onBack} aria-label="Home">
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none" style={{ verticalAlign: 'middle', marginRight: 3 }} aria-hidden>
              <path d="M10 3L5 8l5 5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
            Home
          </button>
        ) : (
          <span className={styles.headerSpacer} aria-hidden />
        )}
        </div>
        <h1 className={styles.headerTitle}>{trip?.title ?? 'Trip'}</h1>
        <div className={styles.headerActions}>
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
        </div>
      </header>
      <main className={styles.mobileMain} data-mobile-scroll>
        {body}
      </main>
      <nav className={styles.tabBar} aria-label="Mobile trip navigation">
        {TABS.map((t) => (
          <button
            key={t.id}
            type="button"
            className={`${styles.tabBtn} ${tab === t.id ? styles.tabBtnActive : ''}`}
            onClick={() => setTab(t.id)}
          >
            {t.icon}
            <span>{t.label}</span>
            {tab === t.id ? <span className={styles.tabDot} aria-hidden /> : null}
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
      {askAiPrompt ? (
        <MobileAskAiResultsSheet
          prompt={askAiPrompt}
          onClose={() => setAskAiPrompt(null)}
          onSavePlace={canUseAiHelpers ? saveNearPlace : undefined}
          onAddToItinerary={canEditItinerary ? addNearToItinerary : undefined}
        />
      ) : null}
      {tab !== 'today' ? <AiAssistantFab /> : null}
      <span aria-hidden style={{ display: 'none' }}>
        v{SOLUTION_VERSION}
      </span>
    </div>
  );
};
