import type { WebPartContext } from '@microsoft/sp-webpart-base';
import { ReminderService, type TripReminder } from '../services/ReminderService';
import { generatePlainTextLines } from '../services/GeminiService';
import { getCurrentUserEmail } from './currentUserEmail';
import { travellerLabelForCurrentUser } from './tripMemberIdentity';
import type { TripMember } from '../models/TripMember';
import type { Trip } from '../models/Trip';

import type { TripDay } from '../models/TripDay';
import { isPreTripDayRow } from './itineraryDayEntries';

export const JOTTER_IDEA_REMINDER_TYPE = 'JotterIdea';

export type JotterIconKind = 'idea' | 'place' | 'photo';

export interface JotterIdeaReply {
  id: string;
  authorEmail: string;
  text: string;
  createdAt: string;
}

export interface JotterIdeaMeta {
  authorEmail?: string;
  isAi?: boolean;
  location?: string;
  focusDayId?: string;
  replies?: JotterIdeaReply[];
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
    const parsed = JSON.parse(raw) as JotterIdeaMeta;
    return {
      authorEmail: parsed.authorEmail,
      isAi: parsed.isAi,
      location: parsed.location?.trim() || undefined,
      focusDayId: parsed.focusDayId,
      replies: Array.isArray(parsed.replies)
        ? parsed.replies
            .filter((r): r is JotterIdeaReply => Boolean(r && typeof r === 'object' && typeof r.text === 'string'))
            .map((r) => ({
              id: r.id || `reply-${Date.now()}`,
              authorEmail: (r.authorEmail || '').trim().toLowerCase(),
              text: String(r.text).trim(),
              createdAt: r.createdAt || new Date().toISOString()
            }))
            .filter((r) => r.text && r.authorEmail)
        : []
    };
  } catch {
    return {};
  }
}

export function parseJotterIdeaMeta(taskNote?: string): JotterIdeaMeta {
  return parseMeta(taskNote);
}

export function jotterIdeaReplies(meta: JotterIdeaMeta): JotterIdeaReply[] {
  return [...(meta.replies ?? [])].sort((a, b) => a.createdAt.localeCompare(b.createdAt));
}

function newReplyId(): string {
  return `reply-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

export function withJotterReplyAdded(
  reminder: TripReminder,
  text: string,
  authorEmail: string
): Pick<TripReminder, 'taskNote'> {
  const meta = parseMeta(reminder.taskNote);
  const reply: JotterIdeaReply = {
    id: newReplyId(),
    authorEmail: authorEmail.trim().toLowerCase(),
    text: text.trim(),
    createdAt: new Date().toISOString()
  };
  return {
    taskNote: serializeMeta({
      ...meta,
      replies: [...(meta.replies ?? []), reply]
    })
  };
}

export function withJotterReplyRemoved(
  reminder: TripReminder,
  replyId: string
): Pick<TripReminder, 'taskNote'> {
  const meta = parseMeta(reminder.taskNote);
  return {
    taskNote: serializeMeta({
      ...meta,
      replies: (meta.replies ?? []).filter((r) => r.id !== replyId)
    })
  };
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
  isAi = false,
  options?: { location?: string; focusDayId?: string }
): Promise<JotterIdeaRow> {
  const trimmed = text.trim();
  if (!isValidJotterIdeaText(trimmed)) {
    throw new Error('Invalid jotter idea text');
  }
  const svc = new ReminderService(spContext);
  const created = await svc.create({
    title: trimmed.slice(0, 80),
    tripId,
    dayId: options?.focusDayId || '',
    entryId: '',
    reminderType: JOTTER_IDEA_REMINDER_TYPE,
    reminderText: trimmed,
    taskNote: serializeMeta({
      authorEmail: getCurrentUserEmail(spContext),
      isAi,
      location: options?.location?.trim() || undefined,
      focusDayId: options?.focusDayId
    }),
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

export async function updateJotterIdeaText(spContext: WebPartContext, id: string, text: string): Promise<void> {
  const trimmed = text.trim();
  if (!isValidJotterIdeaText(trimmed)) throw new Error('Invalid jotter idea text');
  const svc = new ReminderService(spContext);
  await svc.update(id, { title: trimmed.slice(0, 80), reminderText: trimmed });
  notifyChanged();
}

export async function setJotterIdeaComplete(spContext: WebPartContext, id: string, isComplete: boolean): Promise<void> {
  const svc = new ReminderService(spContext);
  await svc.update(id, { isComplete });
  notifyChanged();
}

const AI_DAY_CURSOR_KEY = 'travelhub-jotter-ai-day';

function dayLocationLabel(day: TripDay | undefined, trip?: Trip): string | undefined {
  if (!day) return trip?.destination?.trim() || undefined;
  const title = (day.displayTitle || '').trim();
  if (title) return title;
  return trip?.destination?.trim() || undefined;
}

/** Rotate through itinerary days so AI ideas spread across the trip. */
export function nextAiFocusDay(
  tripId: string,
  tripDays: TripDay[],
  trip?: Trip
): { dayId: string; label: string } | null {
  const eligible = [...tripDays].filter((d) => !isPreTripDayRow(d)).sort((a, b) => a.dayNumber - b.dayNumber);
  if (!eligible.length) return null;
  const key = `${AI_DAY_CURSOR_KEY}-${tripId}`;
  let idx = 0;
  try {
    idx = Number.parseInt(window.sessionStorage.getItem(key) || '0', 10) || 0;
  } catch {
    /* ignore */
  }
  const day = eligible[((idx % eligible.length) + eligible.length) % eligible.length];
  try {
    window.sessionStorage.setItem(key, String((idx + 1) % eligible.length));
  } catch {
    /* ignore */
  }
  const label = dayLocationLabel(day, trip);
  return { dayId: day.id, label: label || `Day ${day.dayNumber}` };
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
  itineraryPlaces: string[] = [],
  focusDayLabel?: string
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
  const dayBlock = focusDayLabel
    ? `\nFocus this suggestion on activities for: ${focusDayLabel}. Do not suggest ideas only relevant to other days.\n`
    : '';
  const prompt = `Suggest exactly 1 short, specific new travel idea (one line only) for the trip to ${place}.${dates}${dayBlock}${placeBlock}${excludeBlock}
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
  itineraryPlaces: string[] = [],
  tripDays: TripDay[] = []
): Promise<JotterIdeaRow | null> {
  const focus = nextAiFocusDay(tripId, tripDays, trip);
  const text = await fetchJotterAiIdeaText(
    apiKey || '',
    trip,
    excludeTexts,
    itineraryPlaces,
    focus?.label
  );
  if (!text) return null;
  try {
    return await createJotterIdea(spContext, tripId, text, members, true, {
      location: focus?.label,
      focusDayId: focus?.dayId
    });
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
  options?: { ensureFreshAi?: boolean; tripDays?: TripDay[] }
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

  const tripDays = options?.tripDays ?? [];

  if (options?.ensureFreshAi && aiNeeded > 0 && (apiKey || '').trim()) {
    const fresh = await createPersistedJotterAiIdea(
      spContext,
      tripId,
      trip,
      members,
      apiKey,
      excludeTexts,
      itineraryPlaces,
      tripDays
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
      itineraryPlaces,
      tripDays
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
