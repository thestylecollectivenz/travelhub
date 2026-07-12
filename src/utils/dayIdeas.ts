import type { WebPartContext } from '@microsoft/sp-webpart-base';
import type { TripMember } from '../models/TripMember';
import type { TripReminder } from '../services/ReminderService';
import { getCurrentUserEmail } from './currentUserEmail';
import { assigneeLabelMatchesCurrentUser } from './tripMemberIdentity';

export const DAY_IDEA_REMINDER_TYPE = 'DayIdea';

export interface DayIdeaMeta {
  authorEmail?: string;
  readBy: string[];
}

export function isDayIdeaReminder(reminder: Pick<TripReminder, 'reminderType'>): boolean {
  return reminder.reminderType === DAY_IDEA_REMINDER_TYPE;
}

export function formatDayIdeaStamp(iso?: string): string {
  if (!iso) return '';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  return d.toLocaleString('en-NZ', {
    day: 'numeric',
    month: 'short',
    hour: 'numeric',
    minute: '2-digit'
  });
}

function normEmail(email: string | undefined): string {
  return (email || '').trim().toLowerCase();
}

export function parseDayIdeaMeta(taskNote?: string): DayIdeaMeta {
  const raw = (taskNote || '').trim();
  if (!raw) return { readBy: [] };
  if (raw.startsWith('{')) {
    try {
      const parsed = JSON.parse(raw) as DayIdeaMeta;
      return {
        authorEmail: parsed.authorEmail ? normEmail(parsed.authorEmail) : undefined,
        readBy: Array.isArray(parsed.readBy) ? parsed.readBy.map(normEmail).filter(Boolean) : []
      };
    } catch {
      return { readBy: [] };
    }
  }
  return { readBy: [] };
}

export function serializeDayIdeaMeta(meta: DayIdeaMeta): string {
  return JSON.stringify({
    authorEmail: meta.authorEmail ? normEmail(meta.authorEmail) : undefined,
    readBy: meta.readBy.map(normEmail).filter(Boolean)
  });
}

export function buildDayIdeaMetaForCreate(ctx: WebPartContext): string {
  return serializeDayIdeaMeta({ authorEmail: getCurrentUserEmail(ctx), readBy: [] });
}

export function isDayIdeaAuthor(
  reminder: TripReminder,
  ctx: WebPartContext,
  members?: TripMember[]
): boolean {
  const meta = parseDayIdeaMeta(reminder.taskNote);
  const mine = normEmail(getCurrentUserEmail(ctx));
  if (meta.authorEmail && meta.authorEmail === mine) return true;
  return assigneeLabelMatchesCurrentUser(ctx, reminder.assignedTo, members);
}

export function isDayIdeaUnread(
  reminder: TripReminder,
  ctx: WebPartContext,
  members?: TripMember[]
): boolean {
  if (reminder.isComplete) return false;
  if (isDayIdeaAuthor(reminder, ctx, members)) return false;
  const mine = normEmail(getCurrentUserEmail(ctx));
  const meta = parseDayIdeaMeta(reminder.taskNote);
  return !meta.readBy.includes(mine);
}

export function withDayIdeaMarkedRead(
  reminder: TripReminder,
  userEmail: string
): Pick<TripReminder, 'taskNote'> {
  const meta = parseDayIdeaMeta(reminder.taskNote);
  const email = normEmail(userEmail);
  if (!email || meta.readBy.includes(email)) return { taskNote: reminder.taskNote };
  return { taskNote: serializeDayIdeaMeta({ ...meta, readBy: [...meta.readBy, email] }) };
}

export function countUnreadDayIdeas(
  rows: TripReminder[],
  ctx: WebPartContext,
  members?: TripMember[]
): number {
  return rows.filter((r) => isDayIdeaReminder(r) && isDayIdeaUnread(r, ctx, members)).length;
}

export type DayIdeaStatusFilter = 'all' | 'open' | 'agreed';

export function matchesDayIdeaStatus(reminder: TripReminder, filter: DayIdeaStatusFilter): boolean {
  if (filter === 'open') return !reminder.isComplete;
  if (filter === 'agreed') return reminder.isComplete;
  return true;
}
