import * as React from 'react';
import * as ReactDOM from 'react-dom';
import { useTripWorkspace } from '../../context/TripWorkspaceContext';
import { useSpContext } from '../../context/SpContext';
import { useTripPermissions } from '../../hooks/useTripPermissions';
import { logTripAccessOnce } from '../../services/TripAccessLogService';
import { createItineraryEntryFromNearYouPlace } from '../../utils/addPlaceToItinerary';
import {
  MOBILE_OPEN_JOURNAL_COMPOSER,
  MOBILE_OPEN_JOTTER_COMPOSE,
  MOBILE_OPEN_LISTS_IDEAS,
  MOBILE_OPEN_PACKING_ADD,
  MOBILE_OPEN_PHOTO_UPLOAD,
  MOBILE_OPEN_SHOPPING_ADD,
  MOBILE_OPEN_TASK_ADD,
  MOBILE_START_ITINERARY_ADD,
  clearCameFromHome,
  consumePendingMobileHomeAdd,
  peekCameFromHome,
  setPendingItineraryAdd
} from '../../utils/mobileHomePendingAction';
import {
  consumePendingTripDay,
  peekPendingTripDayPayload,
  resolvePendingTripDayId
} from '../../utils/mobileTripDayPending';
import { saveTripSavedSpot } from '../../utils/tripSavedSpots';
import { useTripMembers } from '../../hooks/useTripMembers';
import { consumePendingMobileItineraryEdit } from '../../utils/mobileItineraryEditPending';
import { consumePendingMobileHomeAsk } from '../../utils/mobileHomePendingAsk';
import { notifyExpandUnscheduled } from '../../utils/mobileItineraryUiEvents';
import { confirmUserAction } from '../../utils/confirmAction';
import { ItineraryCardEdit } from '../itinerary/ItineraryCardEdit';
import cardStyles from '../itinerary/ItineraryCard.module.css';
import { MobileDayView } from './MobileDayView';
import { MobileJournalView } from './MobileJournalView';
import { MobileListsView } from './MobileListsView';
import { MobileMapView } from './MobileMapView';
import { MobileBookPage } from './MobileBookPage';
import { TripMembersPanel } from '../workspace/TripMembersPanel';
import { AiAssistantFab } from '../workspace/AiAssistantFab';
import { OptionEditPortal } from '../itinerary/OptionEditPortal';
import { MobileAskAiResultsSheet } from './MobileAskAiResultsSheet';
import type { MobileTab } from './mobileTypes';
import type { ShellMode } from '../../hooks/useShellMode';
import { GO_TO_DAY_EVENT } from './MobileTripIdeasList';
import { useTripDayIdeas } from '../../hooks/useTripDayIdeas';
import { useTripRole } from '../../context/TripRoleContext';
import { SOLUTION_VERSION } from '../../appVersion';
import { MobileBrandHeader } from './MobileBrandHeader';
import { resolveSharePointMediaSrc } from '../../utils/sharePointUrl';
import styles from './MobileShell.module.css';

export type { MobileTab } from './mobileTypes';

export interface MobileTripShellProps {
  onBack: () => void;
  initialTab?: MobileTab;
  shellMode?: Extract<ShellMode, 'phone' | 'ipad-portrait'>;
}

function shortDateRange(dateStart: string, dateEnd: string): string {
  const s = new Date(`${dateStart.slice(0, 10)}T00:00:00`);
  const e = new Date(`${dateEnd.slice(0, 10)}T00:00:00`);
  if (Number.isNaN(s.getTime()) || Number.isNaN(e.getTime())) return '';
  const sameYear = s.getFullYear() === e.getFullYear();
  const sameMonth = sameYear && s.getMonth() === e.getMonth();
  const dayMonth = (d: Date, withYear: boolean): string =>
    d.toLocaleDateString('en-NZ', {
      day: 'numeric',
      month: 'short',
      ...(withYear ? { year: 'numeric' as const } : {})
    });
  if (sameMonth) {
    return `${s.getDate()} – ${dayMonth(e, true)}`;
  }
  if (sameYear) {
    return `${dayMonth(s, false)} – ${dayMonth(e, true)}`;
  }
  return `${dayMonth(s, true)} – ${dayMonth(e, true)}`;
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
    id: 'map',
    label: 'Map',
    icon: (
      <svg width="20" height="20" viewBox="0 0 20 20" fill="none" aria-hidden>
        <path d="M10 3C7.24 3 5 5.24 5 8c0 4.25 5 9 5 9s5-4.75 5-9c0-2.76-2.24-5-5-5z" stroke="currentColor" strokeWidth="1.5" />
        <circle cx="10" cy="8" r="1.8" stroke="currentColor" strokeWidth="1.3" />
      </svg>
    )
  },
  {
    id: 'book',
    label: 'Book',
    icon: (
      <svg width="20" height="20" viewBox="0 0 20 20" fill="none" aria-hidden>
        <path d="M4 6h12l1 3.5H3L4 6Z" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round" />
        <path d="M3 9.5h14V15a1.5 1.5 0 01-1.5 1.5h-11A1.5 1.5 0 013 15V9.5Z" stroke="currentColor" strokeWidth="1.5" />
        <path d="M7 12.5h6" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" />
      </svg>
    )
  }
];

export const MobileTripShell: React.FC<MobileTripShellProps> = ({ onBack, initialTab, shellMode = 'phone' }) => {
  const {
    trip,
    tripDays,
    selectedDayId,
    setSelectedDayId,
    localEntries,
    editingCardId,
    setEditingCardId,
    updateEntry,
    deleteEntry,
    reloadItineraryEntries
  } = useTripWorkspace();
  const spContext = useSpContext();
  const { canEditItinerary } = useTripPermissions();
  const { role } = useTripRole();
  const { unreadCount: ideasUnread } = useTripDayIdeas();
  const showIdeasBadge = (role === 'Editor' || role === 'Companion') && ideasUnread > 0;
  const [tab, setTab] = React.useState<MobileTab>(() => {
    if (initialTab === 'tasks') return 'lists';
    return initialTab ?? 'today';
  });
  const [cameFromHome] = React.useState(() => peekCameFromHome());
  const [membersOpen, setMembersOpen] = React.useState(false);
  const [askAiPrompt, setAskAiPrompt] = React.useState<string | null>(null);
  const [cardDetailOpen, setCardDetailOpen] = React.useState(false);
  const [detailHeaderTitle, setDetailHeaderTitle] = React.useState<string | undefined>();
  const closeCardDetailRef = React.useRef<(() => void) | undefined>(undefined);
  const { members } = useTripMembers(trip?.id);

  React.useEffect(() => {
    if (!initialTab) return;
    if (initialTab === 'tasks') {
      setTab('lists');
      window.setTimeout(() => {
        window.dispatchEvent(new CustomEvent(MOBILE_OPEN_TASK_ADD));
      }, 0);
      return;
    }
    setTab(initialTab);
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

  const handleDetailChange = React.useCallback((open: boolean, close?: () => void, headerTitle?: string) => {
    setCardDetailOpen(open);
    closeCardDetailRef.current = close;
    setDetailHeaderTitle(open ? headerTitle : undefined);
  }, []);

  React.useEffect(() => {
    const handler = (e: Event): void => {
      const dayId = (e as CustomEvent<{ dayId?: string }>).detail?.dayId;
      if (!dayId) return;
      setTab('today');
      setSelectedDayId(dayId);
    };
    window.addEventListener(GO_TO_DAY_EVENT, handler);
    return () => window.removeEventListener(GO_TO_DAY_EVENT, handler);
  }, [setSelectedDayId]);

  React.useEffect(() => {
    if (!trip?.id || !localEntries.length) return;
    const pending = consumePendingMobileItineraryEdit();
    if (!pending) return;
    setTab('today');
    setSelectedDayId(pending.dayId);
    notifyExpandUnscheduled();
    if (localEntries.some((e) => e.id === pending.entryId)) {
      setEditingCardId(pending.entryId);
    }
  }, [trip?.id, localEntries, setEditingCardId, setSelectedDayId]);

  React.useEffect(() => {
    if (!trip?.id) return;
    const prompt = consumePendingMobileHomeAsk();
    if (prompt) setAskAiPrompt(prompt);
  }, [trip?.id]);

  React.useEffect(() => {
    if (!trip?.id || !tripDays.length) return;
    if (!peekPendingTripDayPayload(trip.id)) return;
    const dayId = resolvePendingTripDayId(trip.id, tripDays);
    if (dayId) {
      setTab('today');
      setSelectedDayId(dayId);
      consumePendingTripDay(trip.id, tripDays);
    }
  }, [trip?.id, tripDays, setSelectedDayId]);

  React.useEffect(() => {
    if (!trip?.id) return;
    const action = consumePendingMobileHomeAdd();
    if (!action) return;
    const dispatchChild = (): void => {
      switch (action) {
        case 'itinerary_item':
          window.dispatchEvent(new Event(MOBILE_START_ITINERARY_ADD));
          break;
        case 'journal_entry':
          window.dispatchEvent(new Event(MOBILE_OPEN_JOURNAL_COMPOSER));
          break;
        case 'journal_photo':
          window.dispatchEvent(new Event(MOBILE_OPEN_PHOTO_UPLOAD));
          break;
        case 'task':
          window.dispatchEvent(new Event(MOBILE_OPEN_TASK_ADD));
          break;
        case 'packing_item':
          window.dispatchEvent(new Event(MOBILE_OPEN_PACKING_ADD));
          break;
        case 'shopping_item':
          window.dispatchEvent(new Event(MOBILE_OPEN_SHOPPING_ADD));
          break;
        case 'jotter_idea':
          window.dispatchEvent(new Event(MOBILE_OPEN_LISTS_IDEAS));
          window.dispatchEvent(new Event(MOBILE_OPEN_JOTTER_COMPOSE));
          break;
        default:
          break;
      }
    };
    switch (action) {
      case 'itinerary_item':
        setPendingItineraryAdd(true);
        setTab('today');
        window.setTimeout(dispatchChild, 200);
        window.setTimeout(dispatchChild, 600);
        break;
      case 'journal_entry':
        setTab('journal');
        window.setTimeout(dispatchChild, 80);
        break;
      case 'journal_photo':
        setTab('journal');
        window.setTimeout(dispatchChild, 120);
        break;
      case 'task':
        setTab('lists');
        window.setTimeout(dispatchChild, 80);
        break;
      case 'packing_item':
        setTab('lists');
        window.setTimeout(dispatchChild, 80);
        break;
      case 'shopping_item':
        setTab('lists');
        window.setTimeout(dispatchChild, 80);
        break;
      case 'jotter_idea':
        setTab('lists');
        window.setTimeout(dispatchChild, 120);
        break;
      default:
        break;
    }
  }, [trip?.id]);

  const editingEntry = editingCardId ? localEntries.find((e) => e.id === editingCardId) : undefined;
  const editingDay = editingEntry ? tripDays.find((d) => d.id === editingEntry.dayId) : undefined;

  const handleBack = React.useCallback(() => {
    clearCameFromHome();
    onBack();
  }, [onBack]);

  const renderHeaderBack = (): React.ReactNode => {
    if (cardDetailOpen && tab === 'today') {
      return (
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
      );
    }
    if (cameFromHome || tab === 'today') {
      return (
        <button type="button" className={styles.backBtn} onClick={handleBack} aria-label="Home">
          <svg width="16" height="16" viewBox="0 0 16 16" fill="none" style={{ verticalAlign: 'middle', marginRight: 3 }} aria-hidden>
            <path d="M10 3L5 8l5 5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
          Home
        </button>
      );
    }
    return (
      <button type="button" className={styles.backBtn} onClick={() => setTab('today')} aria-label="Back to itinerary">
        <svg width="16" height="16" viewBox="0 0 16 16" fill="none" style={{ verticalAlign: 'middle', marginRight: 3 }} aria-hidden>
          <path d="M10 3L5 8l5 5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
        Itinerary
      </button>
    );
  };

  const saveNearPlace = React.useCallback(
    (place: { name: string; note?: string; mapsUrl?: string; websiteUrl?: string; toolId?: string }): void => {
      if (!trip?.id) return;
      void saveTripSavedSpot(spContext, trip.id, place, members).catch(console.error);
    },
    [trip?.id, spContext, members]
  );

  const addNearToItinerary = React.useCallback(
    async (place: { name: string; note?: string; mapsUrl?: string; websiteUrl?: string }): Promise<void> => {
      if (!trip) throw new Error('No trip open.');
      const day = tripDays.find((d) => d.id === selectedDayId) ?? tripDays[0];
      if (!day) throw new Error('This trip has no days yet.');
      const created = await createItineraryEntryFromNearYouPlace(spContext, trip, day.id, place);
      await reloadItineraryEntries();
      setTab('today');
      setSelectedDayId(day.id);
      setEditingCardId(created.id);
    },
    [trip, tripDays, selectedDayId, spContext, reloadItineraryEntries, setEditingCardId, setSelectedDayId]
  );

  let body: React.ReactNode;
  switch (tab) {
    case 'journal':
      body = <MobileJournalView />;
      break;
    case 'lists':
    case 'tasks':
      body = <MobileListsView />;
      break;
    case 'map':
      body = <MobileMapView />;
      break;
    case 'book':
      body = (
        <MobileBookPage
          destinationHint={trip?.destination || trip?.title || ''}
          showTitle={false}
        />
      );
      break;
    default:
      body = <MobileDayView onOpenMembers={handleOpenMembers} onAskAi={handleAskAi} onDetailChange={handleDetailChange} />;
  }

  const pageChrome = React.useMemo(() => {
    const tripLabel = trip?.title || undefined;
    const start = (trip?.dateStart || '').slice(0, 10);
    const end = (trip?.dateEnd || '').slice(0, 10);
    const dates = start && end ? shortDateRange(start, end) : undefined;

    if (cardDetailOpen) {
      // Detail views: location/card name in trip slot (no dates/thumb row).
      return {
        title: undefined as string | undefined,
        subtitle: undefined as string | undefined,
        tripName: detailHeaderTitle || tripLabel || 'Trip',
        tripDates: undefined as string | undefined,
        showTripHero: false
      };
    }

    switch (tab) {
      case 'journal':
        return {
          title: 'Journal',
          subtitle: 'Entries and photos from your trip',
          tripName: tripLabel,
          tripDates: dates,
          showTripHero: true
        };
      case 'lists':
      case 'tasks':
        return {
          title: 'Lists',
          subtitle: 'Packing, shopping, tasks, and trip ideas',
          tripName: tripLabel,
          tripDates: dates,
          showTripHero: true
        };
      case 'map':
        return {
          title: 'Map',
          subtitle: 'Transport stops and your route across the trip',
          tripName: tripLabel,
          tripDates: dates,
          showTripHero: true
        };
      case 'book':
        return {
          title: 'Book',
          subtitle: 'Search partner sites for stays, flights, tours and more.',
          tripName: tripLabel,
          tripDates: dates,
          showTripHero: true
        };
      default:
        return {
          title: 'Itinerary',
          subtitle: 'Your day-by-day plan',
          tripName: tripLabel,
          tripDates: dates,
          showTripHero: true
        };
    }
  }, [cardDetailOpen, detailHeaderTitle, tab, trip?.title, trip?.dateStart, trip?.dateEnd]);

  const tripHeroSrc = React.useMemo(() => {
    if (!pageChrome.showTripHero) return undefined;
    const raw = (trip?.heroImageUrl || '').trim();
    if (!raw) return null;
    return (
      resolveSharePointMediaSrc(
        raw,
        spContext.pageContext.web.absoluteUrl,
        spContext.pageContext.web.serverRelativeUrl || ''
      ) || null
    );
  }, [pageChrome.showTripHero, trip?.heroImageUrl, spContext]);

  return (
    <div
      className={styles.mobileRoot}
      data-shell={shellMode === 'ipad-portrait' ? 'ipad-portrait' : undefined}
    >
      <MobileBrandHeader
        navRow={renderHeaderBack()}
        title={pageChrome.title}
        subtitle={pageChrome.subtitle}
        tripName={pageChrome.tripName}
        tripDates={pageChrome.tripDates}
        tripHeroSrc={tripHeroSrc}
        actions={
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
        }
      />
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
            {t.id === 'lists' && showIdeasBadge ? (
              <span className={styles.tabBadge} aria-label={`${ideasUnread} new day ideas`}>
                {ideasUnread}
              </span>
            ) : null}
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
          onSavePlace={canEditItinerary ? saveNearPlace : undefined}
          onAddToItinerary={canEditItinerary ? addNearToItinerary : undefined}
        />
      ) : null}
      {editingEntry && !cardDetailOpen
        ? ReactDOM.createPortal(
            <div className={cardStyles.portalEditRoot} role="presentation">
              <div className={cardStyles.portalEditInner}>
                <ItineraryCardEdit
                  key={editingEntry.id}
                  entry={editingEntry}
                  calendarDate={editingDay?.calendarDate || ''}
                  onSave={(saved) => {
                    updateEntry(saved);
                    setEditingCardId(null);
                  }}
                  onCancel={() => setEditingCardId(null)}
                  onDelete={() => {
                    void (async () => {
                      if (!(await confirmUserAction('Delete this itinerary item?'))) return;
                      if (editingEntry) deleteEntry(editingEntry.id);
                      setEditingCardId(null);
                    })();
                  }}
                />
              </div>
            </div>,
            document.body
          )
        : null}
      {tab !== 'today' ? <AiAssistantFab /> : null}
      <OptionEditPortal />
      <span aria-hidden style={{ display: 'none' }}>
        v{SOLUTION_VERSION}
      </span>
    </div>
  );
};
