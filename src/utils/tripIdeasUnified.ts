import type { WebPartContext } from '@microsoft/sp-webpart-base';
import type { TripDay } from '../models/TripDay';
import type { Place } from '../models/Place';
import type { TripReminder } from '../services/ReminderService';
import { ReminderService } from '../services/ReminderService';
import {
  DAY_IDEA_REMINDER_TYPE,
  dayIdeaReplies,
  formatDayIdeaAuthor,
  isDayIdeaAuthor,
  isDayIdeaReminder,
  parseDayIdeaMeta
} from './dayIdeas';
import {
  isJotterIdeaReminder,
  isValidJotterIdeaText,
  jotterIdeaReplies,
  parseJotterIdeaMeta
} from './tripJotterIdeas';
import { getCurrentUserEmail } from './currentUserEmail';
import type { TripMember } from '../models/TripMember';

export type UnifiedIdeaSource = 'jotter' | 'day';

export type TripIdeasFilter = 'all' | 'yours' | 'ai' | 'replies' | 'complete' | 'open';

export interface UnifiedTripIdea {
  id: string;
  source: UnifiedIdeaSource;
  reminder: TripReminder;
  text: string;
  isAi: boolean;
  isComplete: boolean;
  createdAt?: string;
  authorLabel?: string;
  authorEmail?: string;
  dayId?: string;
  locationLabel?: string;
  replyCount: number;
}

function placeLabel(place: Place | undefined, day?: TripDay): string | undefined {
  if (place?.title) {
    const country = (place.country || '').trim();
    return country ? `${place.title}, ${country}` : place.title;
  }
  const title = (day?.displayTitle || '').trim();
  return title || undefined;
}

function rowFromReminder(
  reminder: TripReminder,
  tripDays: TripDay[],
  placeById: (id: string) => Place | undefined,
  tripDestination?: string
): UnifiedTripIdea | null {
  const text = (reminder.reminderText || reminder.title || '').trim();
  if (!text) return null;

  if (isJotterIdeaReminder(reminder)) {
    if (!isValidJotterIdeaText(text)) return null;
    const meta = parseJotterIdeaMeta(reminder.taskNote);
    const replies = jotterIdeaReplies(meta);
    const day = meta.focusDayId ? tripDays.find((d) => d.id === meta.focusDayId) : undefined;
    const dayPlace = day?.primaryPlaceId ? placeById(day.primaryPlaceId) : undefined;
    return {
      id: reminder.id,
      source: 'jotter',
      reminder,
      text,
      isAi: Boolean(meta.isAi),
      isComplete: Boolean(reminder.isComplete),
      createdAt: reminder.dueDate,
      authorLabel: reminder.assignedTo,
      authorEmail: meta.authorEmail,
      dayId: meta.focusDayId || reminder.dayId || undefined,
      locationLabel: meta.location || placeLabel(dayPlace, day) || tripDestination,
      replyCount: replies.length
    };
  }

  if (isDayIdeaReminder(reminder)) {
    const meta = parseDayIdeaMeta(reminder.taskNote);
    const replies = dayIdeaReplies(meta);
    const day = reminder.dayId ? tripDays.find((d) => d.id === reminder.dayId) : undefined;
    const dayPlace = day?.primaryPlaceId ? placeById(day.primaryPlaceId) : undefined;
    return {
      id: reminder.id,
      source: 'day',
      reminder,
      text,
      isAi: false,
      isComplete: Boolean(reminder.isComplete),
      createdAt: reminder.dueDate,
      authorLabel: formatDayIdeaAuthor(reminder) || reminder.assignedTo,
      authorEmail: meta.authorEmail,
      dayId: reminder.dayId || undefined,
      locationLabel: placeLabel(dayPlace, day) || tripDestination,
      replyCount: replies.length
    };
  }

  return null;
}

export async function loadUnifiedTripIdeas(
  spContext: WebPartContext,
  tripId: string,
  tripDays: TripDay[],
  placeById: (id: string) => Place | undefined,
  tripDestination?: string
): Promise<UnifiedTripIdea[]> {
  const svc = new ReminderService(spContext);
  const rows = await svc.getForTrip(tripId);
  return rows
    .map((r) => rowFromReminder(r, tripDays, placeById, tripDestination))
    .filter((r): r is UnifiedTripIdea => Boolean(r))
    .sort((a, b) => (b.createdAt || '').localeCompare(a.createdAt || '') || a.id.localeCompare(b.id));
}

export function isUnifiedIdeaYours(
  idea: UnifiedTripIdea,
  spContext: WebPartContext,
  members?: TripMember[]
): boolean {
  if (idea.isAi) return false;
  if (idea.source === 'day') {
    return isDayIdeaAuthor(idea.reminder, spContext, members);
  }
  const mine = getCurrentUserEmail(spContext).trim().toLowerCase();
  if (idea.authorEmail && idea.authorEmail.toLowerCase() === mine) return true;
  return false;
}

export function matchesTripIdeasFilter(
  idea: UnifiedTripIdea,
  filter: TripIdeasFilter,
  spContext: WebPartContext,
  members?: TripMember[]
): boolean {
  if (filter === 'complete') return idea.isComplete;
  if (idea.isComplete) return false;
  if (filter === 'open') return true;
  if (filter === 'ai') return idea.isAi;
  if (filter === 'yours') return isUnifiedIdeaYours(idea, spContext, members);
  if (filter === 'replies') return idea.replyCount > 0;
  return true;
}

export function formatIdeaTime(iso?: string): string {
  if (!iso) return '';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  return d.toLocaleString('en-NZ', {
    hour: 'numeric',
    minute: '2-digit'
  });
}

export const TRIP_IDEAS_CHANGED_EVENT = 'travelhub-trip-ideas-changed';

export function notifyTripIdeasChanged(): void {
  window.dispatchEvent(new Event(TRIP_IDEAS_CHANGED_EVENT));
}

export function isTripIdeaReminder(reminder: Pick<TripReminder, 'reminderType'>): boolean {
  return reminder.reminderType === DAY_IDEA_REMINDER_TYPE || isJotterIdeaReminder(reminder);
}
