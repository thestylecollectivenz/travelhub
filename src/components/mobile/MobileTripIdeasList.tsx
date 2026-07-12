import * as React from 'react';
import { useTripWorkspace } from '../../context/TripWorkspaceContext';
import { useTripDayIdeas } from '../../hooks/useTripDayIdeas';
import { TripDayIdeasView } from '../dayIdeas/TripDayIdeasView';
import chrome from './MobileTabChrome.module.css';
import { useTripRole } from '../../context/TripRoleContext';

export const GO_TO_DAY_EVENT = 'travelhub-mobile-go-day';

export interface MobileTripIdeasListProps {
  embedded?: boolean;
}

export const MobileTripIdeasList: React.FC<MobileTripIdeasListProps> = () => {
  const { setSelectedDayId } = useTripWorkspace();
  const { role } = useTripRole();
  const { ideas, unreadCount, refresh, markRead, markAllRead } = useTripDayIdeas();

  if (role === 'Follower') {
    return <p className={chrome.muted}>Day ideas are available to editors and companions on this trip.</p>;
  }

  return (
    <TripDayIdeasView
      ideas={ideas}
      unreadCount={unreadCount}
      mobileLayout
      onRefresh={refresh}
      onMarkRead={markRead}
      onMarkAllRead={markAllRead}
      onGoToDay={(dayId) => {
        setSelectedDayId(dayId);
        window.dispatchEvent(new CustomEvent(GO_TO_DAY_EVENT, { detail: { dayId } }));
      }}
    />
  );
};
