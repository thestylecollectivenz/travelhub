import type { WebPartContext } from '@microsoft/sp-webpart-base';
import { ReminderService, type TripReminder } from '../services/ReminderService';
import { generatePlainTextLines } from '../services/GeminiService';
import { getCurrentUserEmail } from './currentUserEmail';
import { travellerLabelForCurrentUser } from './tripMemberIdentity';
import type { TripMember } from '../models/TripMember';
import type { Trip } from '../models/Trip';

export const JOTTER_IDEA_REMINDER_TYPE = 'JotterIdea';

export type JotterIconKind = 'idea' | 'place' | 'photo';

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

export interface JotterDisplayRow extends JotterIdeaRow {
  ephemeral?: boolean;
  icon: JotterIconKind;
}

export const JOTTER_IDEAS_CHANGED_EVENT = 'travelhub-jotter-ideas-changed';

const JOTTER_ICON_CYCLE: JotterIconKind[] = ['idea', 'place', 'photo'];

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

const INVALID_JOTTER_PATTERNS = [
  /^current focus:/i,
  /^latest traveller message:/i,
  /^background trip data:/i,
  /^reply for the current focus/i,
  /^you are a helpful travel/i,
  /^assistant:/i,
  /^traveller:/i
];

export function isValidJotterIdeaText(text: string): boolean {
  const t = text.trim();
  if (t.length < 8 || t.length > 220) return false;
  if (INVALID_JOTTER_PATTERNS.some((re) => re.test(t))) return false;
  if (/^#{1,6}\s/.test(t)) return false;
  return true;
}

function iconForIndex(index: number): JotterIconKind {
  return JOTTER_ICON_CYCLE[index % JOTTER_ICON_CYCLE.length];
}

export async function loadJotterIdeas(spContext: WebPartContext, tripId: string): Promise<JotterIdeaRow[]> {
  const svc = new ReminderService(spContext);
  const rows = await svc.getForTrip(tripId);
  return rows
    .filter(isJotterIdeaReminder)
    .map(rowFromReminder)
    .filter((r) => isValidJotterIdeaText(r.text))
    .sort((a, b) => (b.createdAt || '').localeCompare(a.createdAt || ''));
}

/** Remove persisted AI jotter rows with invalid/garbage text. */
export async function purgeInvalidJotterAiIdeas(spContext: WebPartContext, tripId: string): Promise<void> {
  const svc = new ReminderService(spContext);
  const rows = await svc.getForTrip(tripId);
  const invalid = rows.filter((r) => {
    if (!isJotterIdeaReminder(r)) return false;
    const meta = parseMeta(r.taskNote);
    if (!meta.isAi) return false;
    const text = r.reminderText || r.title || '';
    return !isValidJotterIdeaText(text);
  });
  for (const row of invalid) {
    await svc.delete(row.id);
  }
  if (invalid.length) notifyChanged();
}

export async function createJotterIdea(
  spContext: WebPartContext,
  tripId: string,
  text: string,
  members?: TripMember[],
  isAi = false
): Promise<JotterIdeaRow> {
  const trimmed = text.trim();
  if (!isValidJotterIdeaText(trimmed)) {
    throw new Error('Invalid jotter idea text');
  }
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

function normalizeExcludeKey(text: string): string {
  return text.trim().toLowerCase().replace(/\s+/g, ' ');
}

/** Ask Gemini for one fresh idea, avoiding itinerary and existing jotter text. */
export async function fetchEphemeralJotterAiIdea(
  apiKey: string,
  trip: Trip | undefined,
  excludeTexts: string[]
): Promise<string | null> {
  const key = (apiKey || '').trim();
  if (!key) return null;
  const place = (trip?.destination || trip?.title || 'the trip').trim();
  const dates =
    trip?.dateStart && trip?.dateEnd ? ` Trip dates: ${trip.dateStart.slice(0, 10)} to ${trip.dateEnd.slice(0, 10)}.` : '';
  const exclude = Array.from(new Set(excludeTexts.map(normalizeExcludeKey).filter(Boolean))).slice(0, 40);
  const variety = `${Date.now() % 9973}`;
  const excludeBlock = exclude.length
    ? `\nDo NOT suggest anything already on the itinerary or jotter. Already covered:\n${exclude.map((x) => `- ${x}`).join('\n')}\n`
    : '';
  const prompt = `Suggest exactly 1 short, specific new travel idea (one line only) for ${place}.${dates}${excludeBlock}
Mix activities, food, or experiences. Variety seed: ${variety}. Plain text only.`;
  try {
    const lines = await generatePlainTextLines(key, prompt, 1);
    const line = lines.find((l) => isValidJotterIdeaText(l));
    return line?.trim() || null;
  } catch (err) {
    // eslint-disable-next-line no-console
    console.warn('fetchEphemeralJotterAiIdea failed', err);
    return null;
  }
}

/**
 * Home jotter display: prioritise user ideas, always include 1 fresh ephemeral AI idea.
 */
export async function buildJotterHomeDisplay(
  spContext: WebPartContext,
  tripId: string,
  trip: Trip | undefined,
  members: TripMember[] | undefined,
  apiKey: string | undefined,
  itineraryTitles: string[],
  displayLimit = 3
): Promise<JotterDisplayRow[]> {
  await purgeInvalidJotterAiIdeas(spContext, tripId).catch(console.error);

  const all = await loadJotterIdeas(spContext, tripId);
  const userIdeas = all.filter((r) => !r.isAi);
  const excludeTexts = [
    ...all.map((r) => r.text),
    ...itineraryTitles.filter(Boolean)
  ];

  const expanded = displayLimit > 3;
  const maxUser = userIdeas.length > 0 ? (expanded ? userIdeas.length : Math.min(2, displayLimit - 1)) : 0;
  const pickedUsers = userIdeas.slice(0, maxUser);
  const rows: JotterDisplayRow[] = pickedUsers.map((r, i) => ({
    ...r,
    icon: iconForIndex(i)
  }));

  const aiText = await fetchEphemeralJotterAiIdea(apiKey || '', trip, excludeTexts);
  if (aiText) {
    rows.push({
      id: `ephemeral-ai-${Date.now()}`,
      tripId,
      text: aiText,
      createdAt: new Date().toISOString(),
      authorLabel: 'AI',
      isAi: true,
      ephemeral: true,
      icon: iconForIndex(rows.length)
    });
  }

  let nextUserIdx = maxUser;
  while (rows.length < displayLimit && nextUserIdx < userIdeas.length) {
    const r = userIdeas[nextUserIdx];
    rows.push({ ...r, icon: iconForIndex(rows.length) });
    nextUserIdx += 1;
  }

  return rows.slice(0, displayLimit);
}
