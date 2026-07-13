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
    `What should I pack for ${place}?`,
    `Local food spots in ${place}`,
    `Hidden gems near ${place}`,
    `Rainy day plans for ${place}`
  ];
}

/** Visible chips on home (first two) plus overflow via the … control. */
export function homeAiVisibleChips(trip: Trip | undefined, offset: number, visibleCount = 2): string[] {
  const all = homeAiSuggestionChips(trip);
  if (!all.length) return [];
  const start = ((offset % all.length) + all.length) % all.length;
  const out: string[] = [];
  for (let i = 0; i < Math.min(visibleCount, all.length); i += 1) {
    out.push(all[(start + i) % all.length]);
  }
  return out;
}

function normalizeExcludeKey(text: string): string {
  return text.trim().toLowerCase().replace(/\s+/g, ' ');
}

/** Ask Gemini for one fresh idea, avoiding itinerary and existing jotter text. */
export async function fetchJotterAiIdeaText(
  apiKey: string,
  trip: Trip | undefined,
  excludeTexts: string[],
  itineraryPlaces: string[] = []
): Promise<string | null> {
  const key = (apiKey || '').trim();
  if (!key) return null;
  const place = (trip?.destination || trip?.title || 'the trip').trim();
  const dates =
    trip?.dateStart && trip?.dateEnd ? ` Trip dates: ${trip.dateStart.slice(0, 10)} to ${trip.dateEnd.slice(0, 10)}.` : '';
  const exclude = Array.from(new Set(excludeTexts.map(normalizeExcludeKey).filter(Boolean))).slice(0, 40);
  const placeHints = Array.from(new Set(itineraryPlaces.map((p) => p.trim()).filter(Boolean))).slice(0, 12);
  const variety = `${Date.now() % 9973}`;
  const excludeBlock = exclude.length
    ? `\nDo NOT repeat anything already on the itinerary or jotter. Already covered:\n${exclude.map((x) => `- ${x}`).join('\n')}\n`
    : '';
  const placeBlock = placeHints.length
    ? `\nOnly suggest ideas relevant to this trip's destinations and stops: ${placeHints.join(', ')}. Do not suggest other countries or cities.\n`
    : `\nOnly suggest ideas relevant to ${place}. Do not suggest unrelated destinations.\n`;
  const prompt = `Suggest exactly 1 short, specific new travel idea (one line only) for the trip to ${place}.${dates}${placeBlock}${excludeBlock}
Mix activities, food, or experiences tied to the trip. Variety seed: ${variety}. Plain text only.`;
  try {
    const lines = await generatePlainTextLines(key, prompt, 1);
    const line = lines.find((l) => isValidJotterIdeaText(l));
    return line?.trim() || null;
  } catch (err) {
    // eslint-disable-next-line no-console
    console.warn('fetchJotterAiIdeaText failed', err);
    return null;
  }
}

/** Create and persist one new AI jotter idea when home display needs more. */
export async function createPersistedJotterAiIdea(
  spContext: WebPartContext,
  tripId: string,
  trip: Trip | undefined,
  members: TripMember[] | undefined,
  apiKey: string | undefined,
  excludeTexts: string[],
  itineraryPlaces: string[] = []
): Promise<JotterIdeaRow | null> {
  const text = await fetchJotterAiIdeaText(apiKey || '', trip, excludeTexts, itineraryPlaces);
  if (!text) return null;
  try {
    return await createJotterIdea(spContext, tripId, text, members, true);
  } catch (err) {
    // eslint-disable-next-line no-console
    console.warn('createPersistedJotterAiIdea failed', err);
    return null;
  }
}

const JOTTER_AI_REFRESH_MS = 3 * 60 * 1000;

export function jotterAiRefreshIntervalMs(): number {
  return JOTTER_AI_REFRESH_MS;
}

/**
 * Home jotter display: up to 2 user ideas + enough persisted AI rows to fill the limit (min 1 AI on home).
 */
export async function buildJotterHomeDisplay(
  spContext: WebPartContext,
  tripId: string,
  trip: Trip | undefined,
  members: TripMember[] | undefined,
  apiKey: string | undefined,
  itineraryTitles: string[],
  itineraryPlaces: string[] = [],
  displayLimit = 3,
  options?: { ensureFreshAi?: boolean }
): Promise<JotterDisplayRow[]> {
  await purgeInvalidJotterAiIdeas(spContext, tripId).catch(console.error);

  const all = await loadJotterIdeas(spContext, tripId);
  const userIdeas = all.filter((r) => !r.isAi);
  let aiIdeas = all.filter((r) => r.isAi);
  const excludeTexts = [...all.map((r) => r.text), ...itineraryTitles.filter(Boolean)];

  const expanded = displayLimit > 3;
  const maxUser = expanded ? userIdeas.length : Math.min(2, displayLimit);
  const pickedUsers = userIdeas.slice(0, maxUser);
  const aiNeeded = Math.max(0, displayLimit - pickedUsers.length);

  if (options?.ensureFreshAi && aiNeeded > 0 && (apiKey || '').trim()) {
    const fresh = await createPersistedJotterAiIdea(
      spContext,
      tripId,
      trip,
      members,
      apiKey,
      excludeTexts,
      itineraryPlaces
    );
    if (fresh) {
      aiIdeas = [fresh, ...aiIdeas.filter((r) => r.id !== fresh.id)];
      excludeTexts.push(fresh.text);
    }
  }

  while (aiIdeas.length < aiNeeded && (apiKey || '').trim()) {
    const created = await createPersistedJotterAiIdea(
      spContext,
      tripId,
      trip,
      members,
      apiKey,
      excludeTexts,
      itineraryPlaces
    );
    if (!created) break;
    aiIdeas = [...aiIdeas, created];
    excludeTexts.push(created.text);
  }

  const pickedAi = aiIdeas.slice(0, aiNeeded);
  const rows: JotterDisplayRow[] = [
    ...pickedUsers.map((r, i) => ({ ...r, icon: iconForIndex(i) })),
    ...pickedAi.map((r, i) => ({ ...r, icon: iconForIndex(pickedUsers.length + i) }))
  ];

  let nextUserIdx = maxUser;
  while (rows.length < displayLimit && nextUserIdx < userIdeas.length) {
    const r = userIdeas[nextUserIdx];
    rows.push({ ...r, icon: iconForIndex(rows.length) });
    nextUserIdx += 1;
  }

  return rows.slice(0, displayLimit);
}
