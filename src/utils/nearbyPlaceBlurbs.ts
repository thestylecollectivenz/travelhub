/**
 * One-sentence descriptions for verified nearby places.
 *
 * Gemini is allowed here because it only DESCRIBES places already verified by
 * Google Places / OpenStreetMap — it never discovers venues or invents URLs.
 * One batched request covers a whole visible page of results, and blurbs are
 * cached in localStorage so each place is described at most once per device.
 */

const CACHE_KEY = 'travelhub-nearby-blurbs-v1';
const MAX_CACHE_ENTRIES = 600;

export interface BlurbPlaceInput {
  id: string;
  name: string;
  categoryLabel: string;
  address?: string;
  city?: string;
}

type BlurbCache = Record<string, string>;

function loadCache(): BlurbCache {
  try {
    const raw = window.localStorage.getItem(CACHE_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw) as unknown;
    return parsed && typeof parsed === 'object' ? (parsed as BlurbCache) : {};
  } catch {
    return {};
  }
}

function saveCache(cache: BlurbCache): void {
  try {
    const keys = Object.keys(cache);
    if (keys.length > MAX_CACHE_ENTRIES) {
      for (const key of keys.slice(0, keys.length - MAX_CACHE_ENTRIES)) {
        delete cache[key];
      }
    }
    window.localStorage.setItem(CACHE_KEY, JSON.stringify(cache));
  } catch {
    /* ignore */
  }
}

/** In-flight guard so simultaneous renders don't duplicate the same request. */
const pendingIds = new Set<string>();

async function fetchBlurbsFromGemini(
  places: BlurbPlaceInput[],
  geminiApiKey: string
): Promise<string[] | null> {
  const listing = places
    .map((p, i) => `${i + 1}. ${p.name} — ${p.categoryLabel}${p.address ? `, ${p.address}` : ''}${p.city ? `, ${p.city}` : ''}`)
    .join('\n');
  const prompt =
    `These are real, verified venues. For each, write ONE short sentence (max 18 words) saying what it is ` +
    `and what it's known for. If you don't recognise the specific venue, describe it from its type and setting — ` +
    `do NOT invent specific facts, awards, dishes or dates.\n${listing}\n` +
    `Respond with ONLY a JSON array of ${places.length} strings in the same order, no markdown.`;
  try {
    const { GEMINI_MODEL_FALLBACK_CHAIN } = await import('../services/GeminiService');
    for (const model of GEMINI_MODEL_FALLBACK_CHAIN) {
      const url = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent?key=${encodeURIComponent(geminiApiKey)}`;
      const resp = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{ parts: [{ text: prompt }] }],
          generationConfig: { temperature: 0.3, maxOutputTokens: 900 }
        })
      });
      if (!resp.ok) continue;
      const data = (await resp.json()) as {
        candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }>;
      };
      const raw = (data.candidates?.[0]?.content?.parts?.[0]?.text || '').trim();
      const jsonMatch = raw.match(/\[[\s\S]*\]/);
      if (!jsonMatch) continue;
      const parsed = JSON.parse(jsonMatch[0]) as unknown;
      if (!Array.isArray(parsed)) continue;
      return parsed.map((v) => (typeof v === 'string' ? v.trim() : ''));
    }
  } catch {
    /* ignore */
  }
  return null;
}

/**
 * Returns cached blurbs immediately and fetches missing ones in one batched
 * Gemini call. Resolves with everything available (cached + newly fetched).
 */
export async function getNearbyPlaceBlurbs(
  places: BlurbPlaceInput[],
  geminiApiKey: string
): Promise<Record<string, string>> {
  const cache = loadCache();
  const out: Record<string, string> = {};
  const missing: BlurbPlaceInput[] = [];
  for (const place of places) {
    if (cache[place.id]) {
      out[place.id] = cache[place.id];
    } else if (!pendingIds.has(place.id)) {
      missing.push(place);
    }
  }
  const key = (geminiApiKey || '').trim();
  if (!missing.length || !key) return out;

  missing.forEach((p) => pendingIds.add(p.id));
  try {
    const blurbs = await fetchBlurbsFromGemini(missing, key);
    if (blurbs) {
      missing.forEach((place, i) => {
        const blurb = (blurbs[i] || '').trim();
        if (!blurb) return;
        out[place.id] = blurb;
        cache[place.id] = blurb;
      });
      saveCache(cache);
    }
  } finally {
    missing.forEach((p) => pendingIds.delete(p.id));
  }
  return out;
}
