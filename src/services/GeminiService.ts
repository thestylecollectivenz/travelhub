/**
 * Section 3 answers (from codebase read May 2026):
 * - locationInfoEntry uses `LocationInfoNotes` (not LocationInfoEntry); parse via JSON.parse in parseLocationInfoNotes; serialize via serializeLocationInfoNotes.
 * - Place name/country for prompts: placeDisplayLabel / placeNameFromTitle + place.country from Place model.
 * - Config: UserConfig in ConfigService.ts; batch read via getConfig(userId).
 */

import type { LocationInfoAIResult, NearestPlaceKind, NearestPlaceRow, DiningSuggestionRow } from '../utils/locationInfoEntry';
import type { LocationSearchContext } from '../utils/locationGeoContext';

/**
 * Models to try in order (free tier). Avoid gemini-2.0-flash — often 0 RPM/RPD on new projects.
 * Match IDs to AI Studio → Rate limits for your project.
 */
export const GEMINI_MODEL_FALLBACK_CHAIN = [
  'gemini-3.1-flash-lite',
  'gemini-2.5-flash-lite',
  'gemini-2.5-flash'
] as const;

export const DEFAULT_GEMINI_MODEL: (typeof GEMINI_MODEL_FALLBACK_CHAIN)[number] = GEMINI_MODEL_FALLBACK_CHAIN[0];

export interface LocationInfoGenerationResponse {
  result: LocationInfoAIResult;
  model: string;
}

function isQuotaOrModelBlockedError(err: GeminiServiceError): boolean {
  if (err.status === 429) return true;
  const m = err.message.toLowerCase();
  return (
    m.includes('quota') ||
    m.includes('resource_exhausted') ||
    m.includes('free_tier') ||
    m.includes('limit: 0')
  );
}

export type GeminiErrorCode = 'NO_KEY' | 'API_ERROR' | 'PARSE_ERROR' | 'INVALID_RESPONSE';

export class GeminiServiceError extends Error {
  public readonly code: GeminiErrorCode;

  public readonly status?: number;

  constructor(code: GeminiErrorCode, message: string, status?: number) {
    super(message);
    this.name = 'GeminiServiceError';
    this.code = code;
    this.status = status;
  }
}

export interface GeminiServiceOptions {
  apiKey: string;
  model?: string;
}

function buildPrompt(placeName: string, country: string): string {
  return `You are a travel reference assistant. Generate factual, concise travel highlights for a specific place.

Place: ${placeName}
Country: ${country}

Respond with ONLY a JSON object. No markdown, no code fences, no explanation. Exactly this structure:
{
  "overview": "2-3 sentences about this place relevant to a visitor",
  "practicalTips": "2-4 short bullet-style tips as one string (transport, timing, etiquette, money)",
  "sights": [{"label": "specific sight or attraction", "done": false}],
  "food": [{"label": "specific local food dish or cuisine", "done": false}],
  "drink": [{"label": "specific local drink or beverage", "done": false}],
  "souvenirs": [{"label": "specific souvenir or locally made product", "done": false}]
}

Rules:
- overview: 2-3 sentences maximum, factual, no marketing language
- practicalTips: concise visitor tips, newline-separated if multiple
- Each array: 3-5 items, specific and concrete (not generic like "try local food")
- done is always false
- All six fields required
- No additional fields`;
}

function extractResponseText(data: unknown): string {
  const root = data as {
    candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }>;
  };
  const parts = root.candidates?.[0]?.content?.parts ?? [];
  let text = '';
  for (let i = 0; i < parts.length; i++) {
    text += parts[i]?.text ?? '';
  }
  return text.trim();
}

function stripJsonFences(raw: string): string {
  const t = raw.trim();
  if (t.startsWith('```')) {
    const lines = t.split(/\r?\n/);
    const inner = lines.slice(1, lines[lines.length - 1]?.startsWith('```') ? -1 : undefined);
    return inner.join('\n').trim();
  }
  return t;
}

/** Close truncated JSON by appending missing } / ] after the last complete value. */
function repairTruncatedJson(raw: string): string | undefined {
  let s = raw.trim();
  if (!s) return undefined;
  // Drop a trailing incomplete string / key fragment after the last complete object/array item.
  const lastComplete = Math.max(s.lastIndexOf('}'), s.lastIndexOf(']'));
  if (lastComplete < 0) return undefined;
  s = s.slice(0, lastComplete + 1);
  // Remove trailing commas before we close.
  s = s.replace(/,\s*$/, '');

  const stack: string[] = [];
  let inString = false;
  let escape = false;
  for (let i = 0; i < s.length; i++) {
    const ch = s[i];
    if (inString) {
      if (escape) escape = false;
      else if (ch === '\\') escape = true;
      else if (ch === '"') inString = false;
      continue;
    }
    if (ch === '"') {
      inString = true;
      continue;
    }
    if (ch === '{') stack.push('}');
    else if (ch === '[') stack.push(']');
    else if (ch === '}' || ch === ']') {
      if (!stack.length || stack[stack.length - 1] !== ch) return undefined;
      stack.pop();
    }
  }
  if (inString) return undefined;
  if (!stack.length) return s;
  return s + stack.reverse().join('');
}

/** Pull complete {...} objects from a truncated `items` / `places` array. */
function extractCompleteObjectsArray(raw: string, arrayKey: 'items' | 'places'): unknown[] | undefined {
  const keyIdx = raw.indexOf(`"${arrayKey}"`);
  if (keyIdx < 0) return undefined;
  const arrStart = raw.indexOf('[', keyIdx);
  if (arrStart < 0) return undefined;
  const objects: unknown[] = [];
  let i = arrStart + 1;
  while (i < raw.length) {
    while (i < raw.length && /[\s,]/.test(raw[i])) i += 1;
    if (i >= raw.length || raw[i] === ']') break;
    if (raw[i] !== '{') break;
    let depth = 0;
    let inString = false;
    let escape = false;
    const start = i;
    for (; i < raw.length; i++) {
      const ch = raw[i];
      if (inString) {
        if (escape) escape = false;
        else if (ch === '\\') escape = true;
        else if (ch === '"') inString = false;
        continue;
      }
      if (ch === '"') {
        inString = true;
        continue;
      }
      if (ch === '{') depth += 1;
      else if (ch === '}') {
        depth -= 1;
        if (depth === 0) {
          i += 1;
          const slice = raw.slice(start, i);
          try {
            objects.push(JSON.parse(slice));
          } catch {
            /* skip incomplete */
          }
          break;
        }
      }
    }
    if (depth !== 0) break;
  }
  return objects.length ? objects : undefined;
}

function parseGeminiJson(text: string): unknown {
  const cleaned = stripJsonFences(text).trim();
  if (!cleaned) {
    throw new GeminiServiceError('PARSE_ERROR', 'Gemini returned an empty response.');
  }
  try {
    return JSON.parse(cleaned);
  } catch {
    // Some responses prepend/append prose; recover the first JSON object/array segment.
    const firstObj = cleaned.indexOf('{');
    const firstArr = cleaned.indexOf('[');
    const startCandidates = [firstObj, firstArr].filter((n) => n >= 0);
    if (!startCandidates.length) {
      throw new GeminiServiceError('PARSE_ERROR', 'Could not parse Gemini response as JSON.');
    }
    const start = Math.min(...startCandidates);
    const lastObj = cleaned.lastIndexOf('}');
    const lastArr = cleaned.lastIndexOf(']');
    const end = Math.max(lastObj, lastArr);
    if (end <= start) {
      throw new GeminiServiceError('PARSE_ERROR', 'Could not parse Gemini response as JSON.');
    }
    const segment = cleaned.slice(start, end + 1).trim();
    try {
      return JSON.parse(segment);
    } catch {
      const repaired = repairTruncatedJson(segment) ?? repairTruncatedJson(cleaned.slice(start));
      if (repaired) {
        try {
          return JSON.parse(repaired);
        } catch {
          /* fall through */
        }
      }
      const items = extractCompleteObjectsArray(cleaned.slice(start), 'items');
      if (items) return { items };
      const places = extractCompleteObjectsArray(cleaned.slice(start), 'places');
      if (places) return { places };
      throw new GeminiServiceError('PARSE_ERROR', 'Could not parse Gemini response as JSON.');
    }
  }
}

function validateAIResult(parsed: unknown): LocationInfoAIResult {
  if (!parsed || typeof parsed !== 'object') {
    throw new GeminiServiceError('INVALID_RESPONSE', 'AI response was not a JSON object.');
  }
  const p = parsed as Record<string, unknown>;
  const overview = typeof p.overview === 'string' ? p.overview.trim() : '';
  if (!overview) {
    throw new GeminiServiceError('INVALID_RESPONSE', 'AI response missing overview.');
  }
  const practicalTips = typeof p.practicalTips === 'string' ? p.practicalTips.trim() : '';
  if (!practicalTips) {
    throw new GeminiServiceError('INVALID_RESPONSE', 'AI response missing practicalTips.');
  }

  const readArray = (key: string): Array<{ label: string; done: boolean }> => {
    const arr = p[key];
    if (!Array.isArray(arr) || !arr.length) {
      throw new GeminiServiceError('INVALID_RESPONSE', `AI response missing or empty ${key}.`);
    }
    const out: Array<{ label: string; done: boolean }> = [];
    for (let i = 0; i < arr.length; i++) {
      const row = arr[i] as { label?: string; done?: boolean };
      const label = (row?.label ?? '').trim();
      if (!label) continue;
      out.push({ label, done: false });
    }
    if (!out.length) {
      throw new GeminiServiceError('INVALID_RESPONSE', `AI response had no valid ${key} labels.`);
    }
    return out;
  };

  return {
    overview,
    practicalTips,
    sights: readArray('sights'),
    food: readArray('food'),
    drink: readArray('drink'),
    souvenirs: readArray('souvenirs')
  };
}

function buildQuestionPrompt(
  placeName: string,
  country: string,
  question: string,
  contextSummary: string
): string {
  return `You are a travel assistant. Answer the traveller's question about a specific place.

Place: ${placeName}, ${country}
${contextSummary ? `Existing trip notes:\n${contextSummary}\n` : ''}
Question: ${question}

Respond with ONLY a JSON object:
{"answer":"your helpful answer in 2-6 sentences, with concrete suggestions where relevant"}

Rules:
- Factual and practical; no marketing fluff
- If unsure, say what is uncertain and suggest how to verify
- No markdown, no code fences`;
}

export interface LocationQuestionResponse {
  answer: string;
  model: string;
}

export async function answerLocationQuestion(
  placeName: string,
  country: string,
  question: string,
  options: GeminiServiceOptions & { contextSummary?: string }
): Promise<LocationQuestionResponse> {
  const apiKey = (options.apiKey || '').trim();
  if (!apiKey) {
    throw new GeminiServiceError('NO_KEY', 'Gemini API key is not set.');
  }
  const q = (question || '').trim();
  if (!q) {
    throw new GeminiServiceError('INVALID_RESPONSE', 'Question is empty.');
  }

  const models: string[] = options.model
    ? [options.model, ...GEMINI_MODEL_FALLBACK_CHAIN.filter((m) => m !== options.model)]
    : [...GEMINI_MODEL_FALLBACK_CHAIN];

  let lastErr: GeminiServiceError | undefined;
  for (let i = 0; i < models.length; i++) {
    const model = models[i];
    try {
      const url = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent?key=${encodeURIComponent(apiKey)}`;
      const resp = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [
            {
              parts: [
                {
                  text: buildQuestionPrompt(placeName, country, q, (options.contextSummary || '').trim())
                }
              ]
            }
          ],
          generationConfig: {
            temperature: 0.5,
            maxOutputTokens: 500
          }
        })
      });
      if (!resp.ok) {
        let message = `Gemini API returned ${resp.status}`;
        try {
          const errBody = (await resp.json()) as { error?: { message?: string } };
          if (errBody.error?.message) message = errBody.error.message;
        } catch {
          /* ignore */
        }
        throw new GeminiServiceError('API_ERROR', message, resp.status);
      }
      const data = await resp.json();
      const text = extractResponseText(data);
      const parsed = parseGeminiJson(text);
      const answer =
        parsed && typeof parsed === 'object' && typeof (parsed as { answer?: string }).answer === 'string'
          ? (parsed as { answer: string }).answer.trim()
          : '';
      if (!answer) {
        throw new GeminiServiceError('INVALID_RESPONSE', 'AI response missing answer.');
      }
      return { answer, model };
    } catch (err) {
      if (!(err instanceof GeminiServiceError)) {
        throw new GeminiServiceError('API_ERROR', err instanceof Error ? err.message : 'Gemini request failed.');
      }
      lastErr = err;
      if (err.code === 'PARSE_ERROR' || err.code === 'INVALID_RESPONSE' || err.code === 'NO_KEY') {
        throw err;
      }
      const hasAnother = i < models.length - 1;
      if (hasAnother && isQuotaOrModelBlockedError(err)) {
        continue;
      }
      throw err;
    }
  }
  throw lastErr ?? new GeminiServiceError('API_ERROR', 'No Gemini models available.');
}

async function generateLocationInfoWithModel(
  placeName: string,
  country: string,
  apiKey: string,
  model: string
): Promise<LocationInfoAIResult> {
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent?key=${encodeURIComponent(apiKey)}`;

  const resp = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      contents: [{ parts: [{ text: buildPrompt(placeName, country) }] }],
      generationConfig: {
        temperature: 0.4,
        maxOutputTokens: 800
      }
    })
  });

  if (!resp.ok) {
    let message = `Gemini API returned ${resp.status}`;
    try {
      const errBody = (await resp.json()) as { error?: { message?: string } };
      if (errBody.error?.message) message = errBody.error.message;
    } catch {
      /* ignore */
    }
    throw new GeminiServiceError('API_ERROR', message, resp.status);
  }

  const data = await resp.json();
  const text = extractResponseText(data);
  const parsed = parseGeminiJson(text);

  return validateAIResult(parsed);
}

export async function generateLocationInfo(
  placeName: string,
  country: string,
  options: GeminiServiceOptions
): Promise<LocationInfoGenerationResponse> {
  const apiKey = (options.apiKey || '').trim();
  if (!apiKey) {
    throw new GeminiServiceError('NO_KEY', 'Gemini API key is not set.');
  }

  const models: string[] = options.model
    ? [options.model, ...GEMINI_MODEL_FALLBACK_CHAIN.filter((m) => m !== options.model)]
    : [...GEMINI_MODEL_FALLBACK_CHAIN];

  let lastErr: GeminiServiceError | undefined;
  for (let i = 0; i < models.length; i++) {
    const model = models[i];
    try {
      const result = await generateLocationInfoWithModel(placeName, country, apiKey, model);
      return { result, model };
    } catch (err) {
      if (!(err instanceof GeminiServiceError)) {
        throw new GeminiServiceError('API_ERROR', err instanceof Error ? err.message : 'Gemini request failed.');
      }
      lastErr = err;
      if (err.code === 'PARSE_ERROR' || err.code === 'INVALID_RESPONSE' || err.code === 'NO_KEY') {
        throw err;
      }
      const hasAnother = i < models.length - 1;
      if (hasAnother && isQuotaOrModelBlockedError(err)) {
        // eslint-disable-next-line no-console
        console.warn(`GeminiService: ${model} unavailable (${err.status ?? err.message}), trying next model.`);
        continue;
      }
      throw err;
    }
  }
  throw lastErr ?? new GeminiServiceError('API_ERROR', 'No Gemini models available.');
}

export interface TravelChatMessage {
  role: 'user' | 'assistant';
  text: string;
}

/** General trip-planning chat (not location-card specific). */
export async function answerTravelChat(
  apiKey: string,
  messages: TravelChatMessage[],
  tripContext?: string,
  options?: { model?: string; currentFocusBlock?: string }
): Promise<{ answer: string; model: string }> {
  const key = (apiKey || '').trim();
  if (!key) throw new GeminiServiceError('NO_KEY', 'Add a Gemini API key in User settings.');

  const latest = messages[messages.length - 1];
  const prior = messages.slice(0, -1);
  const priorTranscript = prior
    .map((m) => `${m.role === 'user' ? 'Traveller' : 'Assistant'}: ${m.text}`)
    .join('\n');
  const latestText = latest?.role === 'user' ? latest.text.trim() : '';

  const prompt = `You are a helpful travel planning assistant. Answer clearly and practically.

Before every reply, check the CURRENT FOCUS section — it reflects the traveller's selected day, calendar date, and location right now. Earlier conversation may discuss a different place; do not treat old topics as still current unless the latest message clearly continues them or names another day/place.

${tripContext?.trim() ? `Background trip data:\n${tripContext.trim()}\n\n` : ''}${
    priorTranscript
      ? `Earlier conversation (may reference a different day or location):\n${priorTranscript}\n\n`
      : ''
  }${options?.currentFocusBlock?.trim() ? `${options.currentFocusBlock.trim()}\n\n` : ''}Latest traveller message:
${latestText || '(empty)'}

Reply for the CURRENT FOCUS day, date, and location. Ask a brief clarifying question only when the latest message is ambiguous about place or day. Use plain text or markdown (no HTML). Use [label](url) for links. Keep answers concise unless detail is needed.`;

  const models: string[] = options?.model
    ? [options.model, ...GEMINI_MODEL_FALLBACK_CHAIN.filter((m) => m !== options.model)]
    : [...GEMINI_MODEL_FALLBACK_CHAIN];

  let lastErr: GeminiServiceError | undefined;
  for (let i = 0; i < models.length; i++) {
    const model = models[i];
    try {
      const url = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent?key=${encodeURIComponent(key)}`;
      const resp = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{ parts: [{ text: prompt }] }],
          generationConfig: { temperature: 0.6, maxOutputTokens: 900 }
        })
      });
      if (!resp.ok) {
        throw new GeminiServiceError('API_ERROR', `Gemini API returned ${resp.status}`, resp.status);
      }
      const data = await resp.json();
      const text = extractResponseText(data).trim();
      if (!text) throw new GeminiServiceError('PARSE_ERROR', 'Gemini returned an empty response.');
      return { answer: text, model };
    } catch (err) {
      if (!(err instanceof GeminiServiceError)) {
        throw new GeminiServiceError('API_ERROR', err instanceof Error ? err.message : 'Gemini request failed.');
      }
      lastErr = err;
      if (err.code === 'NO_KEY') throw err;
      const hasAnother = i < models.length - 1;
      if (hasAnother && isQuotaOrModelBlockedError(err)) continue;
      throw err;
    }
  }
  throw lastErr ?? new GeminiServiceError('API_ERROR', 'No Gemini models available.');
}

/** Simple list generation without travel-chat CURRENT FOCUS wrapper. */
export async function generatePlainTextLines(
  apiKey: string,
  userPrompt: string,
  maxLines = 3
): Promise<string[]> {
  const key = (apiKey || '').trim();
  if (!key) throw new GeminiServiceError('NO_KEY', 'Add a Gemini API key in User settings.');

  const prompt = `${userPrompt.trim()}

Reply with ONLY ${maxLines} short lines (one idea per line). No numbering, no labels, no markdown, no preamble.`;

  const models = [...GEMINI_MODEL_FALLBACK_CHAIN];
  let lastErr: GeminiServiceError | undefined;
  for (let i = 0; i < models.length; i++) {
    const model = models[i];
    try {
      const url = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent?key=${encodeURIComponent(key)}`;
      const resp = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{ parts: [{ text: prompt }] }],
          generationConfig: { temperature: 0.85, maxOutputTokens: 400 }
        })
      });
      if (!resp.ok) {
        throw new GeminiServiceError('API_ERROR', `Gemini API returned ${resp.status}`, resp.status);
      }
      const data = await resp.json();
      const text = extractResponseText(data).trim();
      if (!text) throw new GeminiServiceError('PARSE_ERROR', 'Gemini returned an empty response.');
      const lines = text
        .split(/\n+/)
        .map((line) => line.replace(/^[\s*\-•\d.)]+/, '').trim())
        .filter((line) => line.length > 8);
      return Array.from(new Set(lines)).slice(0, maxLines);
    } catch (err) {
      if (!(err instanceof GeminiServiceError)) {
        throw new GeminiServiceError('API_ERROR', err instanceof Error ? err.message : 'Gemini request failed.');
      }
      lastErr = err;
      if (err.code === 'NO_KEY') throw err;
      if (i < models.length - 1 && isQuotaOrModelBlockedError(err)) continue;
      throw err;
    }
  }
  throw lastErr ?? new GeminiServiceError('API_ERROR', 'No Gemini models available.');
}

const NEAREST_KIND_LABEL: Record<NearestPlaceKind, string> = {
  pharmacy: 'pharmacy or chemist',
  grocery: 'grocery store or supermarket',
  fuel: 'fuel station or petrol station',
  atm: 'ATM or cash machine',
  medical: 'medical clinic, urgent care, or hospital',
  restroom: 'public restroom, toilet, or bathroom',
  transport: 'public transport stop, bus stop, train/metro station, or taxi stand'
};

export type DiningVenueFocus = 'restaurants' | 'cafes' | 'attractions';

function buildDiningPrompt(ctx: LocationSearchContext, venueFocus: DiningVenueFocus = 'restaurants'): string {
  const geo = `Coordinates: ${ctx.latitude.toFixed(5)}, ${ctx.longitude.toFixed(5)}`;
  const placeLine =
    ctx.mode === 'onsite'
      ? `The traveller is on-site near ${ctx.placeName}, ${ctx.country}. Use their current GPS as the search anchor.`
      : `Trip destination: ${ctx.placeName}, ${ctx.country}. Suggest venues a visitor would realistically try while there.`;
  const venueLine =
    venueFocus === 'cafes'
      ? 'Focus on coffee shops, bakeries, and casual cafés — not full-service restaurants.'
      : venueFocus === 'attractions'
        ? 'Focus on sightseeing attractions, landmarks, museums, viewpoints, and notable places to visit — not restaurants.'
        : 'Focus on restaurants and substantial dining — include some cafés only if they are standouts.';
  const guideLabel = venueFocus === 'attractions' ? 'local sightseeing guide' : 'local dining guide';
  const preferLine =
    venueFocus === 'attractions'
      ? 'Prefer iconic or well-reviewed visitor attractions'
      : 'Prefer local food/drink highlights';
  return `You are a ${guideLabel}.

${placeLine}
${geo}
${venueLine}

Respond with ONLY a compact JSON object (no markdown, no code fences):
{"items":[{"name":"venue","description":"one short sentence","why":"why go","bestFor":"short phrase","priceLevel":"$$","rating":4.4,"ratingSource":"google","mapsUrl":"","reviewsUrl":"","websiteUrl":""}]}

Rules:
- Exactly 4 venues
- Keep each string under 120 characters
- Real or highly plausible for the area
- ${preferLine}
- Omit empty optional URL fields rather than inventing them`;
}

function buildNearestPrompt(kind: NearestPlaceKind, ctx: LocationSearchContext): string {
  const geo = `Search anchor coordinates: ${ctx.latitude.toFixed(5)}, ${ctx.longitude.toFixed(5)}`;
  const anchorLine =
    ctx.mode === 'onsite'
      ? `The traveller is physically at/near ${ctx.placeName}. Find ${NEAREST_KIND_LABEL[kind]} closest to their CURRENT GPS location (walking or short drive). Do NOT suggest venues in other cities.`
      : `Trip place: ${ctx.placeName}, ${ctx.country}. Find ${NEAREST_KIND_LABEL[kind]} near this destination coordinates (for trip planning).`;
  return `You are a practical travel assistant.

${anchorLine}
${geo}

Respond with ONLY JSON:
{"places":[{"name":"business name","note":"distance only (e.g. 450 m, 1.2 km)","address":"street or area if known","servicesSummary":"key services/features in one sentence","mapsUrl":"optional Google Maps URL","reviewsUrl":"optional reviews search URL","websiteUrl":"official website URL if known"}]}

Rules:
- 3-5 results, nearest first
- name: specific business when possible
- note must not include wording like "from coordinates"
- No markdown, no code fences`;
}

async function callGeminiJson<T>(
  prompt: string,
  apiKey: string,
  modelHint?: string
): Promise<{ parsed: T; model: string }> {
  const models: string[] = modelHint
    ? [modelHint, ...GEMINI_MODEL_FALLBACK_CHAIN.filter((m) => m !== modelHint)]
    : [...GEMINI_MODEL_FALLBACK_CHAIN];

  let lastErr: GeminiServiceError | undefined;
  for (let i = 0; i < models.length; i++) {
    const model = models[i];
    try {
      const url = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent?key=${encodeURIComponent(apiKey)}`;
      const resp = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{ parts: [{ text: prompt }] }],
          generationConfig: {
            temperature: 0.35,
            maxOutputTokens: 2048,
            responseMimeType: 'application/json'
          }
        })
      });
      if (!resp.ok) {
        throw new GeminiServiceError('API_ERROR', `Gemini API returned ${resp.status}`, resp.status);
      }
      const data = await resp.json();
      const text = extractResponseText(data);
      const parsed = parseGeminiJson(text);
      return { parsed: parsed as T, model };
    } catch (err) {
      if (!(err instanceof GeminiServiceError)) {
        throw new GeminiServiceError('API_ERROR', err instanceof Error ? err.message : 'Gemini request failed.');
      }
      lastErr = err;
      if (err.code === 'PARSE_ERROR' || err.code === 'INVALID_RESPONSE' || err.code === 'NO_KEY') throw err;
      if (i < models.length - 1 && isQuotaOrModelBlockedError(err)) continue;
      throw err;
    }
  }
  throw lastErr ?? new GeminiServiceError('API_ERROR', 'No Gemini models available.');
}

export async function generateDiningSuggestions(
  options: GeminiServiceOptions & { searchContext: LocationSearchContext; venueFocus?: DiningVenueFocus }
): Promise<{ items: DiningSuggestionRow[]; model: string }> {
  const apiKey = (options.apiKey || '').trim();
  if (!apiKey) throw new GeminiServiceError('NO_KEY', 'Gemini API key is not set.');
  const venueFocus = options.venueFocus ?? 'restaurants';
  const { parsed, model } = await callGeminiJson<{
    items?: Array<{
      name?: string;
      description?: string;
      why?: string;
      bestFor?: string;
      priceLevel?: string;
      rating?: number;
      ratingSource?: 'google' | 'tripadvisor' | 'mixed';
      mapsUrl?: string;
      reviewsUrl?: string;
      websiteUrl?: string;
    }>;
  }>(buildDiningPrompt(options.searchContext, venueFocus), apiKey, options.model);
  const items: DiningSuggestionRow[] = [];
  const arr = parsed.items ?? [];
  for (let i = 0; i < arr.length; i++) {
    const name = (arr[i]?.name ?? '').trim();
    if (!name) continue;
    items.push({
      id: `dining-ai-${Date.now()}-${i}`,
      name,
      description: (arr[i]?.description ?? '').trim() || undefined,
      why: (arr[i]?.why ?? '').trim() || undefined,
      bestFor: (arr[i]?.bestFor ?? '').trim() || undefined,
      priceLevel: (arr[i]?.priceLevel ?? '').trim() || undefined,
      rating: Number.isFinite(arr[i]?.rating) ? Number(arr[i]?.rating) : undefined,
      ratingSource:
        arr[i]?.ratingSource === 'google' || arr[i]?.ratingSource === 'tripadvisor' || arr[i]?.ratingSource === 'mixed'
          ? arr[i]?.ratingSource
          : undefined,
      mapsUrl: (arr[i]?.mapsUrl ?? '').trim() || undefined,
      reviewsUrl: (arr[i]?.reviewsUrl ?? '').trim() || undefined,
      websiteUrl: (arr[i]?.websiteUrl ?? '').trim() || undefined,
      done: false
    });
  }
  if (!items.length) throw new GeminiServiceError('INVALID_RESPONSE', 'No dining suggestions returned.');
  return { items, model };
}

export async function generateNearestPlaces(
  kind: NearestPlaceKind,
  options: GeminiServiceOptions & { searchContext: LocationSearchContext }
): Promise<{ places: NearestPlaceRow[]; model: string }> {
  const apiKey = (options.apiKey || '').trim();
  if (!apiKey) throw new GeminiServiceError('NO_KEY', 'Gemini API key is not set.');
  const { parsed, model } = await callGeminiJson<{
    places?: Array<{
      name?: string;
      note?: string;
      address?: string;
      servicesSummary?: string;
      mapsUrl?: string;
      reviewsUrl?: string;
      websiteUrl?: string;
    }>;
  }>(buildNearestPrompt(kind, options.searchContext), apiKey, options.model);
  const places: NearestPlaceRow[] = [];
  const arr = parsed.places ?? [];
  for (let i = 0; i < arr.length; i++) {
    const name = (arr[i]?.name ?? '').trim();
    if (!name) continue;
    places.push({
      id: `near-${kind}-${Date.now()}-${i}`,
      name,
      note: (arr[i]?.note ?? '').replace(/\s*from coordinates.*$/i, '').trim() || undefined,
      address: (arr[i]?.address ?? '').trim() || undefined,
      servicesSummary: (arr[i]?.servicesSummary ?? '').trim() || undefined,
      mapsUrl: (arr[i]?.mapsUrl ?? '').trim() || undefined,
      reviewsUrl: (arr[i]?.reviewsUrl ?? '').trim() || undefined,
      websiteUrl: (arr[i]?.websiteUrl ?? '').trim() || undefined
    });
  }
  if (!places.length) throw new GeminiServiceError('INVALID_RESPONSE', 'No nearest places returned.');
  return { places, model };
}

export type ItineraryAiCardType = 'place' | 'attraction' | 'tip';

export interface ItineraryAiSuggestionCard {
  id: string;
  type: ItineraryAiCardType;
  name: string;
  description?: string;
  aiBlurb?: string;
  rating?: number;
  priceLevel?: string;
  travelTime?: string;
  topPick?: boolean;
  mapsUrl?: string;
  websiteUrl?: string;
}

export async function generateItineraryAiSuggestions(
  apiKey: string,
  question: string,
  tripContext: string,
  currentFocusBlock: string
): Promise<{ intro: string; cards: ItineraryAiSuggestionCard[]; chips: string[]; model: string }> {
  const key = (apiKey || '').trim();
  if (!key) throw new GeminiServiceError('NO_KEY', 'Add a Gemini API key in User settings.');
  const q = question.trim();
  if (!q) throw new GeminiServiceError('INVALID_RESPONSE', 'Enter a question first.');

  const prompt = `You are a travel planning assistant. The traveller asked a question about their current trip day/location.

${tripContext.trim() ? `Trip data:\n${tripContext.trim()}\n\n` : ''}${currentFocusBlock.trim() ? `${currentFocusBlock.trim()}\n\n` : ''}Question: ${q}

Respond with ONLY JSON:
{"intro":"one sentence summary","cards":[{"type":"place","name":"venue","description":"short meta","aiBlurb":"why pick this","rating":4.5,"priceLevel":"$$","travelTime":"6 min walk","topPick":true,"mapsUrl":"","websiteUrl":""}],"chips":["More like this","Open now","Family friendly"]}

Rules:
- 2-4 cards mixing place/restaurant (type place), sights (type attraction), and practical tips (type tip) when relevant
- topPick true on at most one card
- Keep strings short; omit empty URL fields
- chips: 3-4 short refinement suggestions`;

  const { parsed, model } = await callGeminiJson<{
    intro?: string;
    cards?: Array<{
      type?: string;
      name?: string;
      description?: string;
      aiBlurb?: string;
      rating?: number;
      priceLevel?: string;
      travelTime?: string;
      topPick?: boolean;
      mapsUrl?: string;
      websiteUrl?: string;
    }>;
    chips?: string[];
  }>(prompt, key);

  const cards: ItineraryAiSuggestionCard[] = [];
  const arr = parsed.cards ?? [];
  for (let i = 0; i < arr.length; i++) {
    const name = (arr[i]?.name ?? '').trim();
    if (!name) continue;
    const rawType = (arr[i]?.type ?? 'place').trim();
    const type: ItineraryAiCardType =
      rawType === 'attraction' || rawType === 'tip' ? rawType : 'place';
    cards.push({
      id: `ai-card-${Date.now()}-${i}`,
      type,
      name,
      description: (arr[i]?.description ?? '').trim() || undefined,
      aiBlurb: (arr[i]?.aiBlurb ?? '').trim() || undefined,
      rating: Number.isFinite(arr[i]?.rating) ? Number(arr[i]?.rating) : undefined,
      priceLevel: (arr[i]?.priceLevel ?? '').trim() || undefined,
      travelTime: (arr[i]?.travelTime ?? '').trim() || undefined,
      topPick: Boolean(arr[i]?.topPick),
      mapsUrl: (arr[i]?.mapsUrl ?? '').trim() || undefined,
      websiteUrl: (arr[i]?.websiteUrl ?? '').trim() || undefined
    });
  }

  return {
    intro: (parsed.intro ?? '').trim() || 'Here are some suggestions.',
    cards,
    chips: (parsed.chips ?? []).map((c) => String(c).trim()).filter(Boolean).slice(0, 5),
    model
  };
}

