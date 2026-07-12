import type { WebPartContext } from '@microsoft/sp-webpart-base';
import type { TripMember } from '../models/TripMember';
import type { TripReminder } from '../services/ReminderService';
import { getCurrentUserEmail } from './currentUserEmail';
import { assigneeLabelMatchesCurrentUser, resolveTravellerDisplayLabel } from './tripMemberIdentity';

export const DAY_IDEA_REMINDER_TYPE = 'DayIdea';

export interface DayIdeaReply {
  id: string;
  authorEmail: string;
  text: string;
  createdAt: string;
}

export interface DayIdeaMeta {
  authorEmail?: string;
  readBy: string[];
  replies?: DayIdeaReply[];
}

function newReplyId(): string {
  return `reply-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
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

/** Traveller-facing author label — resolves email/login to TripMembers display name. */
export function formatDayIdeaAuthor(reminder: TripReminder, members?: TripMember[]): string | undefined {
  const fromAssigned = resolveTravellerDisplayLabel(reminder.assignedTo, members);
  if (fromAssigned) return fromAssigned;
  const meta = parseDayIdeaMeta(reminder.taskNote);
  if (meta.authorEmail) {
    const fromAuthor = resolveTravellerDisplayLabel(meta.authorEmail, members);
    if (fromAuthor) return fromAuthor;
  }
  const fallback = (reminder.assignedTo ?? '').trim();
  return fallback || undefined;
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
        readBy: Array.isArray(parsed.readBy) ? parsed.readBy.map(normEmail).filter(Boolean) : [],
        replies: Array.isArray(parsed.replies)
          ? parsed.replies
              .filter((r): r is DayIdeaReply => Boolean(r && typeof r === 'object' && typeof (r as DayIdeaReply).text === 'string'))
              .map((r) => ({
                id: r.id || newReplyId(),
                authorEmail: normEmail(r.authorEmail),
                text: String(r.text).trim(),
                createdAt: r.createdAt || new Date().toISOString()
              }))
              .filter((r) => r.text && r.authorEmail)
          : []
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
    readBy: meta.readBy.map(normEmail).filter(Boolean),
    replies: (meta.replies ?? []).map((r) => ({
      id: r.id,
      authorEmail: normEmail(r.authorEmail),
      text: r.text.trim(),
      createdAt: r.createdAt
    }))
  });
}

export function dayIdeaReplies(meta: DayIdeaMeta): DayIdeaReply[] {
  return [...(meta.replies ?? [])].sort((a, b) => a.createdAt.localeCompare(b.createdAt));
}

export function withDayIdeaReplyAdded(
  reminder: TripReminder,
  text: string,
  authorEmail: string
): Pick<TripReminder, 'taskNote'> {
  const meta = parseDayIdeaMeta(reminder.taskNote);
  const email = normEmail(authorEmail);
  const reply: DayIdeaReply = {
    id: newReplyId(),
    authorEmail: email,
    text: text.trim(),
    createdAt: new Date().toISOString()
  };
  const readBy = meta.readBy.filter((e) => e === email || e === meta.authorEmail);
  return {
    taskNote: serializeDayIdeaMeta({
      ...meta,
      replies: [...(meta.replies ?? []), reply],
      readBy
    })
  };
}

export function withDayIdeaReplyRemoved(
  reminder: TripReminder,
  replyId: string
): Pick<TripReminder, 'taskNote'> {
  const meta = parseDayIdeaMeta(reminder.taskNote);
  return {
    taskNote: serializeDayIdeaMeta({
      ...meta,
      replies: (meta.replies ?? []).filter((r) => r.id !== replyId)
    })
  };
}

export function formatDayIdeaReplyAuthor(reply: DayIdeaReply, members?: TripMember[]): string {
  const fromEmail = resolveTravellerDisplayLabel(reply.authorEmail, members);
  return fromEmail || reply.authorEmail;
}

export function canManageDayIdeaReply(
  reply: DayIdeaReply,
  ctx: WebPartContext,
  members?: TripMember[],
  canEditItinerary = false
): boolean {
  if (canEditItinerary) return true;
  return normEmail(getCurrentUserEmail(ctx)) === normEmail(reply.authorEmail);
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
