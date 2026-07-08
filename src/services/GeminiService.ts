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
      const text = stripJsonFences(extractResponseText(data));
      if (!text) {
        throw new GeminiServiceError('PARSE_ERROR', 'Gemini returned an empty response.');
      }
      let parsed: unknown;
      try {
        parsed = JSON.parse(text);
      } catch {
        throw new GeminiServiceError('PARSE_ERROR', 'Could not parse Gemini response as JSON.');
      }
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
  const text = stripJsonFences(extractResponseText(data));
  if (!text) {
    throw new GeminiServiceError('PARSE_ERROR', 'Gemini returned an empty response.');
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch {
    throw new GeminiServiceError('PARSE_ERROR', 'Could not parse Gemini response as JSON.');
  }

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

const NEAREST_KIND_LABEL: Record<NearestPlaceKind, string> = {
  pharmacy: 'pharmacy or chemist',
  grocery: 'grocery store or supermarket',
  fuel: 'fuel station or petrol station',
  atm: 'ATM or cash machine',
  medical: 'medical clinic, urgent care, or hospital'
};

function buildDiningPrompt(ctx: LocationSearchContext): string {
  const geo = `Coordinates: ${ctx.latitude.toFixed(5)}, ${ctx.longitude.toFixed(5)}`;
  const placeLine =
    ctx.mode === 'onsite'
      ? `The traveller is on-site near ${ctx.placeName}, ${ctx.country}. Use their current GPS as the search anchor.`
      : `Trip destination: ${ctx.placeName}, ${ctx.country}. Suggest venues a visitor would realistically try while there.`;
  return `You are a local dining guide.

${placeLine}
${geo}

Respond with ONLY JSON:
{"items":[{"name":"venue name","description":"1 sentence about the venue","why":"why a traveller should go","bestFor":"short phrase like 'best for Alsatian tart and wine bar vibe'","priceLevel":"$, $$, $$$ or $$$$","rating":4.4,"ratingSource":"google|tripadvisor|mixed","mapsUrl":"optional Google Maps search URL","reviewsUrl":"optional Google/Tripadvisor reviews URL","websiteUrl":"official venue URL when known"}]}

Rules:
- 4-6 concrete restaurants, cafés, or food markets
- Real or highly plausible for the area
- Prefer a mix of places tied to local food/drink highlights; not every venue must match every highlight
- Include rating and price level where possible
- No markdown, no code fences`;
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
          generationConfig: { temperature: 0.35, maxOutputTokens: 700 }
        })
      });
      if (!resp.ok) {
        throw new GeminiServiceError('API_ERROR', `Gemini API returned ${resp.status}`, resp.status);
      }
      const data = await resp.json();
      const text = stripJsonFences(extractResponseText(data));
      if (!text) throw new GeminiServiceError('PARSE_ERROR', 'Gemini returned an empty response.');
      let parsed: unknown;
      try {
        parsed = JSON.parse(text);
      } catch {
        throw new GeminiServiceError('PARSE_ERROR', 'Could not parse Gemini response as JSON.');
      }
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
  options: GeminiServiceOptions & { searchContext: LocationSearchContext }
): Promise<{ items: DiningSuggestionRow[]; model: string }> {
  const apiKey = (options.apiKey || '').trim();
  if (!apiKey) throw new GeminiServiceError('NO_KEY', 'Gemini API key is not set.');
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
  }>(buildDiningPrompt(options.searchContext), apiKey, options.model);
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

