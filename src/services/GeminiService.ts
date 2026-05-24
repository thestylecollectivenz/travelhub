/**
 * Section 3 answers (from codebase read May 2026):
 * - locationInfoEntry uses `LocationInfoNotes` (not LocationInfoEntry); parse via JSON.parse in parseLocationInfoNotes; serialize via serializeLocationInfoNotes.
 * - Place name/country for prompts: placeDisplayLabel / placeNameFromTitle + place.country from Place model.
 * - Config: UserConfig in ConfigService.ts; batch read via getConfig(userId).
 */

import type { LocationInfoAIResult } from '../utils/locationInfoEntry';

export const DEFAULT_GEMINI_MODEL = 'gemini-2.0-flash';

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
  "sights": [{"label": "specific sight or attraction", "done": false}],
  "food": [{"label": "specific local food dish or cuisine", "done": false}],
  "drink": [{"label": "specific local drink or beverage", "done": false}],
  "souvenirs": [{"label": "specific souvenir or locally made product", "done": false}]
}

Rules:
- overview: 2-3 sentences maximum, factual, no marketing language
- Each array: 3-5 items, specific and concrete (not generic like "try local food")
- done is always false
- All five fields required
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
    sights: readArray('sights'),
    food: readArray('food'),
    drink: readArray('drink'),
    souvenirs: readArray('souvenirs')
  };
}

export async function generateLocationInfo(
  placeName: string,
  country: string,
  options: GeminiServiceOptions
): Promise<LocationInfoAIResult> {
  const apiKey = (options.apiKey || '').trim();
  if (!apiKey) {
    throw new GeminiServiceError('NO_KEY', 'Gemini API key is not set.');
  }

  const model = options.model || DEFAULT_GEMINI_MODEL;
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent?key=${encodeURIComponent(apiKey)}`;

  try {
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
  } catch (err) {
    if (err instanceof GeminiServiceError) throw err;
    throw new GeminiServiceError('API_ERROR', err instanceof Error ? err.message : 'Gemini request failed.');
  }
}
