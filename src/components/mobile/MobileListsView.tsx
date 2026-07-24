import * as React from 'react';
import { PlanViewProvider } from '../../context/PlanViewContext';
import { MobilePackingList } from './MobilePackingList';
import { MobileShoppingList } from './MobileShoppingList';
import { MobileShoppingFilters } from './MobileShoppingFilters';
import { MobileTripJotterList } from './MobileTripJotterList';
import { MobileTaskView } from './MobileTaskView';
import { MobileFilterDisclosure } from './MobileFilterDisclosure';
import { useTripMembers } from '../../hooks/useTripMembers';
import { useTripWorkspace } from '../../context/TripWorkspaceContext';
import { useTripRole } from '../../context/TripRoleContext';
import { useCompanionListDefaults } from '../../hooks/useCompanionListDefaults';
import { usePlanView } from '../../context/PlanViewContext';
import { useSpContext } from '../../context/SpContext';
import { PackingService } from '../../services/PackingService';
import { ShoppingListService } from '../../services/ShoppingListService';
import { useShellMode } from '../../hooks/useShellMode';
import chrome from './MobileTabChrome.module.css';
import {
  MOBILE_OPEN_LISTS_IDEAS,
  MOBILE_OPEN_JOTTER_COMPOSE,
  MOBILE_OPEN_PACKING_ADD,
  MOBILE_OPEN_SHOPPING_ADD,
  MOBILE_OPEN_TASK_ADD,
  consumePendingMobileListsIdeas
} from '../../utils/mobileHomePendingAction';

function StatIcon({ children, tone }: { children: React.ReactNode; tone: 'olive' | 'rust' | 'navy' | 'tan' }): React.ReactElement {
  const cls =
    tone === 'olive' ? chrome.statIconOlive : tone === 'rust' ? chrome.statIconRust : tone === 'tan' ? chrome.statIconTan : chrome.statIconNavy;
  return <span className={`${chrome.statIcon} ${cls}`}>{children}</span>;
}

const MobileListsBody: React.FC = () => {
  const [sub, setSub] = React.useState<'packing' | 'shopping' | 'ideas' | 'tasks'>('packing');
  const [filtersOpen, setFiltersOpen] = React.useState(false);
  const { trip } = useTripWorkspace();
  const planView = usePlanView();
  const spContext = useSpContext();
  const shellMode = useShellMode();
  const { role } = useTripRole();
  const { members, travellers } = useTripMembers(trip?.id);
  useCompanionListDefaults(planView, role, members);

  React.useEffect(() => {
    const openPacking = (): void => setSub('packing');
    const openShopping = (): void => setSub('shopping');
    const openIdeas = (): void => setSub('ideas');
    const openTasks = (): void => setSub('tasks');
    window.addEventListener(MOBILE_OPEN_PACKING_ADD, openPacking);
    window.addEventListener(MOBILE_OPEN_SHOPPING_ADD, openShopping);
    window.addEventListener(MOBILE_OPEN_LISTS_IDEAS, openIdeas);
    window.addEventListener(MOBILE_OPEN_JOTTER_COMPOSE, openIdeas);
    window.addEventListener(MOBILE_OPEN_TASK_ADD, openTasks);
    if (consumePendingMobileListsIdeas()) setSub('ideas');
    return () => {
      window.removeEventListener(MOBILE_OPEN_PACKING_ADD, openPacking);
      window.removeEventListener(MOBILE_OPEN_SHOPPING_ADD, openShopping);
      window.removeEventListener(MOBILE_OPEN_LISTS_IDEAS, openIdeas);
      window.removeEventListener(MOBILE_OPEN_JOTTER_COMPOSE, openIdeas);
      window.removeEventListener(MOBILE_OPEN_TASK_ADD, openTasks);
    };
  }, []);

  React.useEffect(() => {
    setFiltersOpen(false);
  }, [sub]);

  const [packingTotal, setPackingTotal] = React.useState(0);
  const [packingPacked, setPackingPacked] = React.useState(0);
  const [shoppingTotal, setShoppingTotal] = React.useState(0);
  const [shoppingBought, setShoppingBought] = React.useState(0);
  const [shoppingOrdered, setShoppingOrdered] = React.useState(0);

  React.useEffect(() => {
    if (!trip?.id) return;
    const packing = new PackingService(spContext);
    const shopping = new ShoppingListService(spContext);
    void packing.getForTrip(trip.id).then((rows) => {
      setPackingTotal(rows.length);
      setPackingPacked(rows.filter((r) => r.isPacked).length);
    });
    void shopping.getForTrip(trip.id).then((rows) => {
      setShoppingTotal(rows.length);
      setShoppingBought(rows.filter((r) => r.isPurchased).length);
      setShoppingOrdered(rows.filter((r) => !r.isPurchased && (r.websiteUrl || '').trim()).length);
    });
  }, [trip?.id, spContext]);

  const shoppingToBuy = Math.max(0, shoppingTotal - shoppingBought - shoppingOrdered);
  const canIdeas = role === 'Editor' || role === 'Companion';
  const segmentClass = canIdeas ? `${chrome.segmented} ${chrome.segmented4}` : `${chrome.segmented} ${chrome.segmented3}`;

  return (
    <div data-shell={shellMode === 'ipad-portrait' ? 'ipad-portrait' : undefined}>
      <div className={segmentClass} role="tablist" aria-label="List type">
        <button
          type="button"
          role="tab"
          aria-selected={sub === 'packing'}
          className={`${chrome.segmentBtn} ${sub === 'packing' ? chrome.segmentActive : ''}`}
          onClick={() => setSub('packing')}
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" aria-hidden>
            <rect x="5" y="7" width="14" height="13" rx="2" stroke="currentColor" strokeWidth="1.6" />
            <path d="M9 7V5h6v2" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
          </svg>
          Packing
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={sub === 'shopping'}
          className={`${chrome.segmentBtn} ${sub === 'shopping' ? chrome.segmentActive : ''}`}
          onClick={() => setSub('shopping')}
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" aria-hidden>
            <path d="M6 7h15l-1.5 9H7.5L6 7Z" stroke="currentColor" strokeWidth="1.6" strokeLinejoin="round" />
            <circle cx="9" cy="19" r="1.5" fill="currentColor" />
            <circle cx="17" cy="19" r="1.5" fill="currentColor" />
          </svg>
          Shopping
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={sub === 'tasks'}
          className={`${chrome.segmentBtn} ${sub === 'tasks' ? chrome.segmentActive : ''}`}
          onClick={() => setSub('tasks')}
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" aria-hidden>
            <path d="M5 12l4 4 10-10" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
            <rect x="3" y="4" width="18" height="16" rx="2" stroke="currentColor" strokeWidth="1.5" />
          </svg>
          Tasks
        </button>
        {canIdeas ? (
          <button
            type="button"
            role="tab"
            aria-selected={sub === 'ideas'}
            className={`${chrome.segmentBtn} ${sub === 'ideas' ? chrome.segmentActive : ''}`}
            onClick={() => setSub('ideas')}
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" aria-hidden>
              <path d="M9 5h11M9 12h11M9 19h11M4 5h.01M4 12h.01M4 19h.01" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
            </svg>
            Ideas
          </button>
        ) : null}
      </div>

      {sub === 'ideas' ? (
        <MobileTripJotterList />
      ) : sub === 'tasks' ? (
        <MobileTaskView hideChrome />
      ) : sub === 'packing' ? (
        <>
          <div className={`${chrome.statRow} ${chrome.statRow3}`}>
            <div className={chrome.statCard}>
              <StatIcon tone="navy">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" aria-hidden>
                  <rect x="5" y="7" width="14" height="13" rx="2" stroke="currentColor" strokeWidth="1.6" />
                </svg>
              </StatIcon>
              <span className={chrome.statValue}>{packingTotal}</span>
              <span className={chrome.statLabel}>Total items</span>
            </div>
            <div className={chrome.statCard}>
              <StatIcon tone="olive">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" aria-hidden>
                  <path d="M6 12l4 4 8-8" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              </StatIcon>
              <span className={chrome.statValue}>{packingPacked}</span>
              <span className={chrome.statLabel}>Packed</span>
            </div>
            <div className={chrome.statCard}>
              <StatIcon tone="rust">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" aria-hidden>
                  <path d="M6 7h15l-1.5 9H7.5L6 7Z" stroke="currentColor" strokeWidth="1.6" />
                </svg>
              </StatIcon>
              <span className={chrome.statValue}>{shoppingTotal}</span>
              <span className={chrome.statLabel}>Shopping</span>
            </div>
          </div>
          <MobilePackingList embedded />
        </>
      ) : (
        <>
          <div className={chrome.statRow}>
            <div className={chrome.statCard}>
              <StatIcon tone="navy">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" aria-hidden>
                  <path d="M6 7h15l-1.5 9H7.5L6 7Z" stroke="currentColor" strokeWidth="1.6" />
                </svg>
              </StatIcon>
              <span className={chrome.statValue}>{shoppingTotal}</span>
              <span className={chrome.statLabel}>Total items</span>
            </div>
            <div className={chrome.statCard}>
              <StatIcon tone="rust">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" aria-hidden>
                  <circle cx="12" cy="12" r="8" stroke="currentColor" strokeWidth="1.6" strokeDasharray="3 3" />
                </svg>
              </StatIcon>
              <span className={chrome.statValue}>{shoppingToBuy}</span>
              <span className={chrome.statLabel}>To buy</span>
            </div>
            <div className={chrome.statCard}>
              <StatIcon tone="tan">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" aria-hidden>
                  <rect x="4" y="6" width="16" height="12" rx="2" stroke="currentColor" strokeWidth="1.6" />
                </svg>
              </StatIcon>
              <span className={chrome.statValue}>{shoppingOrdered}</span>
              <span className={chrome.statLabel}>Ordered</span>
            </div>
            <div className={chrome.statCard}>
              <StatIcon tone="olive">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" aria-hidden>
                  <path d="M6 12l4 4 8-8" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
                </svg>
              </StatIcon>
              <span className={chrome.statValue}>{shoppingBought}</span>
              <span className={chrome.statLabel}>Bought</span>
            </div>
          </div>
          <MobileFilterDisclosure open={filtersOpen} onToggle={() => setFiltersOpen((v) => !v)}>
            <MobileShoppingFilters travellers={travellers} />
          </MobileFilterDisclosure>
          <MobileShoppingList embedded />
        </>
      )}
    </div>
  );
};

export const MobileListsView: React.FC = () => {
  return (
    <PlanViewProvider>
      <MobileListsBody />
    </PlanViewProvider>
  );
};
