import type { WebPartContext } from '@microsoft/sp-webpart-base';
import { ReminderService, type TripReminder } from '../services/ReminderService';
import { answerTravelChat } from '../services/GeminiService';
import { getCurrentUserEmail } from './currentUserEmail';
import { travellerLabelForCurrentUser } from './tripMemberIdentity';
import type { TripMember } from '../models/TripMember';
import type { Trip } from '../models/Trip';

export const JOTTER_IDEA_REMINDER_TYPE = 'JotterIdea';

export interface JotterIdeaMeta {
  authorEmail?: string;
  isAi?: boolean;
}

export interface JotterIdeaRow {
  id: string;
  tripId: string;
  text: string;
  createdAt?: string;
  authorLabel?: string;
  isAi: boolean;
}

export const JOTTER_IDEAS_CHANGED_EVENT = 'travelhub-jotter-ideas-changed';

function notifyChanged(): void {
  window.dispatchEvent(new Event(JOTTER_IDEAS_CHANGED_EVENT));
}

function parseMeta(taskNote?: string): JotterIdeaMeta {
  const raw = (taskNote || '').trim();
  if (!raw.startsWith('{')) return {};
  try {
    return JSON.parse(raw) as JotterIdeaMeta;
  } catch {
    return {};
  }
}

function serializeMeta(meta: JotterIdeaMeta): string {
  return JSON.stringify(meta);
}

export function isJotterIdeaReminder(reminder: Pick<TripReminder, 'reminderType'>): boolean {
  return reminder.reminderType === JOTTER_IDEA_REMINDER_TYPE;
}

function rowFromReminder(r: TripReminder): JotterIdeaRow {
  const meta = parseMeta(r.taskNote);
  return {
    id: r.id,
    tripId: r.tripId,
    text: r.reminderText || r.title || '',
    createdAt: r.dueDate,
    authorLabel: r.assignedTo,
    isAi: Boolean(meta.isAi)
  };
}

export async function loadJotterIdeas(spContext: WebPartContext, tripId: string): Promise<JotterIdeaRow[]> {
  const svc = new ReminderService(spContext);
  const rows = await svc.getForTrip(tripId);
  return rows
    .filter(isJotterIdeaReminder)
    .map(rowFromReminder)
    .sort((a, b) => (b.createdAt || '').localeCompare(a.createdAt || ''));
}

export async function createJotterIdea(
  spContext: WebPartContext,
  tripId: string,
  text: string,
  members?: TripMember[],
  isAi = false
): Promise<JotterIdeaRow> {
  const trimmed = text.trim();
  const svc = new ReminderService(spContext);
  const created = await svc.create({
    title: trimmed.slice(0, 80),
    tripId,
    dayId: '',
    entryId: '',
    reminderType: JOTTER_IDEA_REMINDER_TYPE,
    reminderText: trimmed,
    taskNote: serializeMeta({ authorEmail: getCurrentUserEmail(spContext), isAi }),
    assignedTo: isAi ? 'AI' : travellerLabelForCurrentUser(spContext, members),
    isComplete: false,
    dueDate: new Date().toISOString()
  });
  notifyChanged();
  return rowFromReminder(created);
}

export async function deleteJotterIdea(spContext: WebPartContext, id: string): Promise<void> {
  const svc = new ReminderService(spContext);
  await svc.delete(id);
  notifyChanged();
}

export function homeAiSuggestionChips(trip?: Trip): string[] {
  const place = (trip?.destination || trip?.title || 'your trip').trim();
  return [
    `Ideas for 3 days in ${place}`,
    `Best things to do in ${place}`,
    `What should I pack for ${place}?`
  ];
}

function parseIdeaLines(answer: string, limit: number): string[] {
  const lines = answer
    .split(/\n+/)
    .map((line) => line.replace(/^[\s*\-•\d.)]+/, '').trim())
    .filter((line) => line.length > 8);
  const unique = Array.from(new Set(lines));
  return unique.slice(0, limit);
}

/** Ask Gemini for short trip ideas (one line each). */
export async function generateJotterAiIdeas(
  apiKey: string,
  trip: Trip | undefined,
  count: number
): Promise<string[]> {
  const place = (trip?.destination || trip?.title || 'the trip').trim();
  const dates =
    trip?.dateStart && trip?.dateEnd ? ` Dates: ${trip.dateStart.slice(0, 10)} to ${trip.dateEnd.slice(0, 10)}.` : '';
  const prompt = `Suggest exactly ${count} short, specific travel ideas (one line each, no numbering) for ${place}.${dates} Mix activities, food, and experiences. Plain text only, one idea per line.`;
  const { answer } = await answerTravelChat(apiKey, [{ role: 'user', text: prompt }], undefined, undefined);
  return parseIdeaLines(answer, count);
}

/** Load jotter ideas and top up with AI-labelled rows when fewer than minCount. */
export async function ensureJotterDisplayIdeas(
  spContext: WebPartContext,
  tripId: string,
  trip: Trip | undefined,
  members: TripMember[] | undefined,
  apiKey: string | undefined,
  minCount = 3
): Promise<JotterIdeaRow[]> {
  let rows = await loadJotterIdeas(spContext, tripId);
  if (rows.length >= minCount) return rows.slice(0, minCount);
  const need = minCount - rows.length;
  const key = (apiKey || '').trim();
  if (need > 0 && key) {
    try {
      const generated = await generateJotterAiIdeas(key, trip, need);
      for (const text of generated) {
        if (!text.trim()) continue;
        await createJotterIdea(spContext, tripId, text, members, true);
      }
      rows = await loadJotterIdeas(spContext, tripId);
    } catch (err) {
      // eslint-disable-next-line no-console
      console.warn('ensureJotterDisplayIdeas: AI top-up failed', err);
    }
  }
  return rows.slice(0, minCount);
}
