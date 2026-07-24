import * as React from 'react';
import { useTripPermissions } from '../../hooks/useTripPermissions';
import { useShellMode } from '../../hooks/useShellMode';
import { MobileDayView, type MobileDayViewProps } from './MobileDayView';
import { MobileBudgetView } from './MobileBudgetView';
import chrome from './MobileTabChrome.module.css';

export type MobileItineraryMenu = 'plan' | 'budget';

export interface MobileItineraryPageProps extends MobileDayViewProps {
  /** Controlled menu selection (optional). */
  menu?: MobileItineraryMenu;
  onMenuChange?: (menu: MobileItineraryMenu) => void;
}

/**
 * Itinerary hub: day plan plus Budget for Editors and Companions.
 * Companions can view budget; only Editors can edit items (same as desktop rules).
 */
export const MobileItineraryPage: React.FC<MobileItineraryPageProps> = ({
  menu: menuProp,
  onMenuChange,
  ...dayProps
}) => {
  const { canSeeFinancials } = useTripPermissions();
  const shellMode = useShellMode();
  const [menuLocal, setMenuLocal] = React.useState<MobileItineraryMenu>('plan');
  const menu = menuProp ?? menuLocal;

  const setMenu = React.useCallback(
    (next: MobileItineraryMenu): void => {
      if (menuProp === undefined) setMenuLocal(next);
      onMenuChange?.(next);
    },
    [menuProp, onMenuChange]
  );

  React.useEffect(() => {
    if (!canSeeFinancials && menu === 'budget') setMenu('plan');
  }, [canSeeFinancials, menu, setMenu]);

  return (
    <div data-shell={shellMode === 'ipad-portrait' ? 'ipad-portrait' : undefined}>
      {canSeeFinancials ? (
        <div className={chrome.segmented} role="tablist" aria-label="Itinerary menu">
          <button
            type="button"
            role="tab"
            aria-selected={menu === 'plan'}
            className={`${chrome.segmentBtn} ${menu === 'plan' ? chrome.segmentActive : ''}`}
            onClick={() => setMenu('plan')}
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" aria-hidden>
              <rect x="4" y="5" width="16" height="14" rx="2" stroke="currentColor" strokeWidth="1.6" />
              <path d="M8 3v4M16 3v4M4 10h16" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
            </svg>
            Plan
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={menu === 'budget'}
            className={`${chrome.segmentBtn} ${menu === 'budget' ? chrome.segmentActive : ''}`}
            onClick={() => setMenu('budget')}
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" aria-hidden>
              <path
                d="M4 7.5h16v11H4V7.5Z"
                stroke="currentColor"
                strokeWidth="1.6"
                strokeLinejoin="round"
              />
              <path d="M8 7.5V5.5a4 4 0 0 1 8 0v2" stroke="currentColor" strokeWidth="1.6" />
              <circle cx="12" cy="13" r="1.4" fill="currentColor" />
            </svg>
            Budget
          </button>
        </div>
      ) : null}

      {menu === 'budget' && canSeeFinancials ? (
        <MobileBudgetView onOpenPlan={() => setMenu('plan')} />
      ) : (
        <MobileDayView {...dayProps} />
      )}
    </div>
  );
};
