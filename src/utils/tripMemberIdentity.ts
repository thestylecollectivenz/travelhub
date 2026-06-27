import { WebPartContext } from '@microsoft/sp-webpart-base';
import type { TripMember } from '../models/TripMember';
import { getCurrentUserEmail } from './currentUserEmail';

function norm(value: string | undefined): string {
  return (value ?? '').trim().toLowerCase();
}

/** True when a traveller / assignee label refers to the signed-in user. */
export function assigneeLabelMatchesCurrentUser(
  ctx: WebPartContext,
  label: string | undefined,
  members?: TripMember[]
): boolean {
  const mine = getCurrentUserEmail(ctx);
  const n = norm(label);
  if (!n) return false;
  if (n === mine) return true;
  const display = norm(ctx.pageContext.user.displayName);
  if (display && display === n) return true;
  for (const m of members ?? []) {
    if (m.userEmail !== mine) continue;
    if (norm(m.userDisplayName) === n) return true;
    if (norm(m.userEmail) === n) return true;
    const local = m.userEmail.split('@')[0];
    if (local && norm(local) === n) return true;
  }
  return false;
}

/** True when filter label matches item label (exact or same user identity). */
export function assigneeLabelsMatch(
  ctx: WebPartContext,
  itemLabel: string | undefined,
  filterLabel: string | undefined,
  members?: TripMember[]
): boolean {
  const item = (itemLabel ?? '').trim();
  const filter = (filterLabel ?? '').trim();
  if (!filter) return true;
  if (item === filter) return true;
  if (assigneeLabelMatchesCurrentUser(ctx, item, members) && assigneeLabelMatchesCurrentUser(ctx, filter, members)) {
    return true;
  }
  return norm(item) === norm(filter);
}

/** Owner email for a list row when assigned to a traveller / assignee label. */
export function resolveOwnerEmailForAssignee(
  ctx: WebPartContext,
  assigneeLabel: string | undefined,
  members: TripMember[]
): string {
  const label = (assigneeLabel ?? '').trim();
  if (!label) return getCurrentUserEmail(ctx);
  for (const m of members) {
    if (norm(m.userDisplayName) === norm(label) || norm(m.userEmail) === norm(label)) {
      return m.userEmail;
    }
  }
  if (assigneeLabelMatchesCurrentUser(ctx, label, members)) {
    return getCurrentUserEmail(ctx);
  }
  return getCurrentUserEmail(ctx);
}

/** Primary assignee label for the signed-in companion (display name preferred). */
export function companionAssigneeLabel(ctx: WebPartContext, members: TripMember[]): string | null {
  const mine = getCurrentUserEmail(ctx);
  const member = members.find((m) => m.userEmail === mine);
  if (member?.userDisplayName?.trim()) return member.userDisplayName.trim();
  const display = ctx.pageContext.user.displayName?.trim();
  return display || null;
}
