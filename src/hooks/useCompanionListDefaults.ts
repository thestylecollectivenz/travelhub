import * as React from 'react';
import { useSpContext } from '../context/SpContext';
import type { PlanViewContextValue } from '../context/PlanViewContext';
import type { TripRoleLevel } from '../models/TripMember';
import type { TripMember } from '../models/TripMember';
import { companionAssigneeLabel } from '../utils/tripMemberIdentity';

/** For companions, default list filters to their own assignee and show all packing categories. */
export function useCompanionListDefaults(
  planView: PlanViewContextValue | undefined,
  role: TripRoleLevel,
  members: TripMember[]
): void {
  const spContext = useSpContext();

  React.useEffect(() => {
    if (!planView || role !== 'Companion') return;
    const label = companionAssigneeLabel(spContext, members);
    if (!label) return;
    planView.setPackingCategory('__all__');
    planView.setPackingTraveller(label);
    planView.setShoppingTraveller(label);
    planView.setTaskAssigneeFilter(label);
  }, [planView, role, members, spContext]);
}
