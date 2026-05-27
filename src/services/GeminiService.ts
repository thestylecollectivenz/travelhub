/**
 * Section 3 answers (from codebase read May 2026):
 * - locationInfoEntry uses `LocationInfoNotes` (not LocationInfoEntry); parse via JSON.parse in parseLocationInfoNotes; serialize via serializeLocationInfoNotes.
 * - Place name/country for prompts: placeDisplayLabel / placeNameFromTitle + place.country from Place model.
 * - Config: UserConfig in ConfigService.ts; batch read via getConfig(userId).
 */

import type { LocationInfoAIResult } from '../utils/locationInfoEntry';

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
