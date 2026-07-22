import type { WebPartContext } from '@microsoft/sp-webpart-base';
import type { TripDay } from '../models/TripDay';
import type { Place } from '../models/Place';
import type { ItineraryEntry } from '../models/ItineraryEntry';
import type { TripReminder } from '../services/ReminderService';
import { ReminderService } from '../services/ReminderService';
import {
  DAY_IDEA_REMINDER_TYPE,
  dayIdeaReplies,
  formatDayIdeaAuthor,
  isDayIdeaAuthor,
  isDayIdeaReminder,
  parseDayIdeaMeta,
  serializeDayIdeaMeta
} from './dayIdeas';
import {
  isJotterIdeaReminder,
  isValidJotterIdeaText,
  jotterIdeaReplies,
  parseJotterIdeaMeta
} from './tripJotterIdeas';
import { getCurrentUserEmail } from './currentUserEmail';
import type { TripMember } from '../models/TripMember';
import { itineraryLocationsForDay, resolveIdeaLocationLabel } from './ideaLocationLabel';

export type UnifiedIdeaSource = 'jotter' | 'day';

export type TripIdeasFilter =
  | 'all'
  | 'yours'
  | 'ai'
  | 'replies'
  | 'complete'
  | 'open'
  | 'favourites'
  | 'favouritesByTraveller'
  | 'favouritesByLocation';

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
  /** e.g. "Day 12 · 18 Nov" when the idea is tied to a trip day. */
  dayLabel?: string;
  locationLabel?: string;
  replyCount: number;
  favouritedBy: string[];
}

function formatIdeaDayLabel(day: TripDay | undefined): string | undefined {
  if (!day) return undefined;
  const ymd = (day.calendarDate || '').slice(0, 10);
  const datePart = ymd
    ? new Date(`${ymd}T12:00:00`).toLocaleDateString('en-NZ', { day: 'numeric', month: 'short' })
    : '';
  const dayPart = typeof day.dayNumber === 'number' ? `Day ${day.dayNumber}` : '';
  const out = [dayPart, datePart].filter(Boolean).join(' · ');
  return out || undefined;
}

function rowFromReminder(
  reminder: TripReminder,
  tripDays: TripDay[],
  placeById: (id: string) => Place | undefined,
  tripDestination?: string,
  localEntries: ItineraryEntry[] = []
): UnifiedTripIdea | null {
  const text = (reminder.reminderText || reminder.title || '').trim();
  if (!text) return null;

  if (isJotterIdeaReminder(reminder)) {
    if (!isValidJotterIdeaText(text)) return null;
    const meta = parseJotterIdeaMeta(reminder.taskNote);
    const replies = jotterIdeaReplies(meta);
    const day = meta.focusDayId ? tripDays.find((d) => d.id === meta.focusDayId) : undefined;
    const dayLocations = day ? itineraryLocationsForDay(day.id, localEntries) : [];
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
      dayLabel: formatIdeaDayLabel(day),
      locationLabel: resolveIdeaLocationLabel(day, meta.location, placeById, dayLocations, tripDestination),
      replyCount: replies.length,
      favouritedBy: meta.favouritedBy ?? []
    };
  }

  if (isDayIdeaReminder(reminder)) {
    const meta = parseDayIdeaMeta(reminder.taskNote);
    const replies = dayIdeaReplies(meta);
    const day = reminder.dayId ? tripDays.find((d) => d.id === reminder.dayId) : undefined;
    const dayLocations = day ? itineraryLocationsForDay(day.id, localEntries) : [];
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
      dayLabel: formatIdeaDayLabel(day),
      locationLabel: resolveIdeaLocationLabel(day, undefined, placeById, dayLocations, tripDestination),
      replyCount: replies.length,
      favouritedBy: meta.favouritedBy ?? []
    };
  }

  return null;
}

export async function loadUnifiedTripIdeas(
  spContext: WebPartContext,
  tripId: string,
  tripDays: TripDay[],
  placeById: (id: string) => Place | undefined,
  tripDestination?: string,
  localEntries: ItineraryEntry[] = []
): Promise<UnifiedTripIdea[]> {
  const svc = new ReminderService(spContext);
  const rows = await svc.getForTrip(tripId);
  return rows
    .map((r) => rowFromReminder(r, tripDays, placeById, tripDestination, localEntries))
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
  if (filter === 'favourites') {
    const mine = getCurrentUserEmail(spContext).trim().toLowerCase();
    return (idea.favouritedBy || []).some((e) => e.toLowerCase() === mine);
  }
  if (filter === 'favouritesByTraveller' || filter === 'favouritesByLocation') {
    return (idea.favouritedBy || []).length > 0;
  }
  return true;
}

export function ideaIsFavouritedByMe(idea: UnifiedTripIdea, spContext: WebPartContext): boolean {
  const mine = getCurrentUserEmail(spContext).trim().toLowerCase();
  return (idea.favouritedBy || []).some((e) => e.toLowerCase() === mine);
}

export function ideaHasAnyFavourite(idea: UnifiedTripIdea): boolean {
  return (idea.favouritedBy || []).length > 0;
}

export function resolveFavouriterLabel(
  email: string,
  members?: TripMember[]
): { email: string; name: string; avatarUrl?: string } {
  const key = email.trim().toLowerCase();
  const match = (members || []).find((m) => m.userEmail.trim().toLowerCase() === key);
  if (match) {
    return {
      email: key,
      name: (match.userDisplayName || match.userEmail || key).trim() || key,
      avatarUrl: match.avatarUrl
    };
  }
  return { email: key, name: key };
}

/** Groups open favourited ideas under each traveller who favourited them (idea may appear in multiple groups). */
export function groupIdeasByFavouriter(
  ideas: UnifiedTripIdea[],
  spContext: WebPartContext,
  members?: TripMember[]
): Array<{ email: string; name: string; avatarUrl?: string; isMe: boolean; ideas: UnifiedTripIdea[] }> {
  const mine = getCurrentUserEmail(spContext).trim().toLowerCase();
  const map = new Map<string, UnifiedTripIdea[]>();
  for (const idea of ideas) {
    for (const raw of idea.favouritedBy || []) {
      const email = raw.trim().toLowerCase();
      if (!email) continue;
      const list = map.get(email) ?? [];
      list.push(idea);
      map.set(email, list);
    }
  }
  const groups = Array.from(map.entries()).map(([email, groupIdeas]) => {
    const label = resolveFavouriterLabel(email, members);
    return {
      email,
      name: label.name,
      avatarUrl: label.avatarUrl,
      isMe: email === mine,
      ideas: groupIdeas
    };
  });
  groups.sort((a, b) => {
    if (a.isMe !== b.isMe) return a.isMe ? -1 : 1;
    return a.name.localeCompare(b.name, undefined, { sensitivity: 'base' });
  });
  return groups;
}

/** Groups favourited ideas under each location label. */
export function groupIdeasByLocation(
  ideas: UnifiedTripIdea[]
): Array<{ location: string; ideas: UnifiedTripIdea[] }> {
  const map = new Map<string, UnifiedTripIdea[]>();
  for (const idea of ideas) {
    if (!(idea.favouritedBy || []).length) continue;
    const location = (idea.locationLabel || '').trim() || 'No location';
    const list = map.get(location) ?? [];
    list.push(idea);
    map.set(location, list);
  }
  return Array.from(map.entries())
    .map(([location, groupIdeas]) => ({ location, ideas: groupIdeas }))
    .sort((a, b) => {
      if (a.location === 'No location') return 1;
      if (b.location === 'No location') return -1;
      return a.location.localeCompare(b.location, undefined, { sensitivity: 'base' });
    });
}

export function favouritedByLabels(
  idea: UnifiedTripIdea,
  members?: TripMember[]
): Array<{ email: string; name: string }> {
  return (idea.favouritedBy || [])
    .map((e) => resolveFavouriterLabel(e, members))
    .sort((a, b) => a.name.localeCompare(b.name, undefined, { sensitivity: 'base' }));
}

export async function toggleUnifiedIdeaFavourite(
  spContext: WebPartContext,
  idea: UnifiedTripIdea
): Promise<void> {
  const mine = getCurrentUserEmail(spContext).trim().toLowerCase();
  if (!mine) return;
  const svc = new ReminderService(spContext);
  if (idea.source === 'jotter' || isJotterIdeaReminder(idea.reminder)) {
    const meta = parseJotterIdeaMeta(idea.reminder.taskNote);
    const set = new Set((meta.favouritedBy || []).map((e) => e.toLowerCase()));
    if (set.has(mine)) set.delete(mine);
    else set.add(mine);
    await svc.update(idea.id, {
      taskNote: JSON.stringify({ ...meta, favouritedBy: Array.from(set) })
    });
    return;
  }
  const meta = parseDayIdeaMeta(idea.reminder.taskNote);
  const set = new Set((meta.favouritedBy || []).map((e) => e.toLowerCase()));
  if (set.has(mine)) set.delete(mine);
  else set.add(mine);
  await svc.update(idea.id, {
    taskNote: serializeDayIdeaMeta({ ...meta, favouritedBy: Array.from(set) })
  });
}

export function isIdeaRecentlyAdded(iso?: string, withinHours = 48): boolean {
  if (!iso) return false;
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return false;
  return Date.now() - d.getTime() < withinHours * 60 * 60 * 1000;
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
