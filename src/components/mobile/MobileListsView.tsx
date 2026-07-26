import * as React from 'react';
import { PlanViewProvider } from '../../context/PlanViewContext';
import { MobilePackingList } from './MobilePackingList';
import { MobileShoppingList } from './MobileShoppingList';
import { MobileTripJotterList } from './MobileTripJotterList';
import { MobileTaskView } from './MobileTaskView';
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
  const { trip } = useTripWorkspace();
  const planView = usePlanView();
  const spContext = useSpContext();
  const shellMode = useShellMode();
  const { role } = useTripRole();
  const { members } = useTripMembers(trip?.id);
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

  const [packingTotal, setPackingTotal] = React.useState(0);
  const [packingPacked, setPackingPacked] = React.useState(0);
  const [shoppingTotal, setShoppingTotal] = React.useState(0);
  const [shoppingBought, setShoppingBought] = React.useState(0);

  React.useEffect(() => {
    if (!trip?.id) return;
    const packing = new PackingService(spContext);
    const shopping = new ShoppingListService(spContext);
    const reload = (): void => {
      void packing.getForTrip(trip.id).then((rows) => {
        setPackingTotal(rows.length);
        setPackingPacked(rows.filter((r) => r.isPacked).length);
      });
      void shopping.getForTrip(trip.id).then((rows) => {
        setShoppingTotal(rows.length);
        setShoppingBought(rows.filter((r) => r.isPurchased).length);
      });
    };
    reload();
    window.addEventListener('travelhub-shopping-items-changed', reload);
    return () => window.removeEventListener('travelhub-shopping-items-changed', reload);
  }, [trip?.id, spContext]);

  const shoppingToBuy = Math.max(0, shoppingTotal - shoppingBought);
  const canIdeas = role === 'Editor' || role === 'Companion';
  const segmentClass = canIdeas ? `${chrome.segmented} ${chrome.segmented4}` : `${chrome.segmented} ${chrome.segmented3}`;
  const packingPackedFilter = planView?.packingPackedFilter ?? 'all';
  const shoppingStatusFilter = planView?.shoppingStatusFilter ?? 'all';

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
            <rect x="5" y="4" width="14" height="16" rx="2" stroke="currentColor" strokeWidth="1.6" />
            <path d="M8 9h8M8 13h5" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
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
              <path
                d="M9 18h6M10 21h4M12 3a6 6 0 0 0-3.5 10.8c.7.5 1.1 1.2 1.2 2.2h4.6c.1-1 .5-1.7 1.2-2.2A6 6 0 0 0 12 3Z"
                stroke="currentColor"
                strokeWidth="1.6"
                strokeLinejoin="round"
              />
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
            <button
              type="button"
              className={`${chrome.statCard} ${chrome.statCardBtn} ${packingPackedFilter === 'all' ? chrome.statCardActive : ''}`}
              onClick={() => planView?.setPackingPackedFilter('all')}
            >
              <StatIcon tone="navy">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" aria-hidden>
                  <rect x="5" y="7" width="14" height="13" rx="2" stroke="currentColor" strokeWidth="1.6" />
                </svg>
              </StatIcon>
              <span className={chrome.statValue}>{packingTotal}</span>
              <span className={chrome.statLabel}>Total items</span>
            </button>
            <button
              type="button"
              className={`${chrome.statCard} ${chrome.statCardBtn} ${packingPackedFilter === 'packed' ? chrome.statCardActive : ''}`}
              onClick={() =>
                planView?.setPackingPackedFilter(packingPackedFilter === 'packed' ? 'all' : 'packed')
              }
            >
              <StatIcon tone="olive">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" aria-hidden>
                  <path d="M6 12l4 4 8-8" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              </StatIcon>
              <span className={chrome.statValue}>{packingPacked}</span>
              <span className={chrome.statLabel}>Packed</span>
            </button>
            <button
              type="button"
              className={`${chrome.statCard} ${chrome.statCardBtn}`}
              onClick={() => setSub('shopping')}
            >
              <StatIcon tone="rust">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" aria-hidden>
                  <path d="M6 7h15l-1.5 9H7.5L6 7Z" stroke="currentColor" strokeWidth="1.6" />
                </svg>
              </StatIcon>
              <span className={chrome.statValue}>{shoppingTotal}</span>
              <span className={chrome.statLabel}>Shopping</span>
            </button>
          </div>
          <MobilePackingList embedded />
        </>
      ) : (
        <>
          <div className={`${chrome.statRow} ${chrome.statRow3}`}>
            <button
              type="button"
              className={`${chrome.statCard} ${chrome.statCardBtn} ${shoppingStatusFilter === 'all' ? chrome.statCardActive : ''}`}
              onClick={() => planView?.setShoppingStatusFilter('all')}
            >
              <StatIcon tone="navy">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" aria-hidden>
                  <path d="M6 7h15l-1.5 9H7.5L6 7Z" stroke="currentColor" strokeWidth="1.6" />
                </svg>
              </StatIcon>
              <span className={chrome.statValue}>{shoppingTotal}</span>
              <span className={chrome.statLabel}>Total items</span>
            </button>
            <button
              type="button"
              className={`${chrome.statCard} ${chrome.statCardBtn} ${shoppingStatusFilter === 'tobuy' ? chrome.statCardActive : ''}`}
              onClick={() =>
                planView?.setShoppingStatusFilter(shoppingStatusFilter === 'tobuy' ? 'all' : 'tobuy')
              }
            >
              <StatIcon tone="rust">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" aria-hidden>
                  <circle cx="12" cy="12" r="8" stroke="currentColor" strokeWidth="1.6" strokeDasharray="3 3" />
                </svg>
              </StatIcon>
              <span className={chrome.statValue}>{shoppingToBuy}</span>
              <span className={chrome.statLabel}>To buy</span>
            </button>
            <button
              type="button"
              className={`${chrome.statCard} ${chrome.statCardBtn} ${shoppingStatusFilter === 'purchased' ? chrome.statCardActive : ''}`}
              onClick={() =>
                planView?.setShoppingStatusFilter(shoppingStatusFilter === 'purchased' ? 'all' : 'purchased')
              }
            >
              <StatIcon tone="olive">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" aria-hidden>
                  <path d="M6 12l4 4 8-8" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
                </svg>
              </StatIcon>
              <span className={chrome.statValue}>{shoppingBought}</span>
              <span className={chrome.statLabel}>Purchased</span>
            </button>
          </div>
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
