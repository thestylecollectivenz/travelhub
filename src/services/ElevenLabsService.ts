/**
 * ElevenLabs Text-to-Speech (free plan includes API + monthly credits).
 * Docs: https://elevenlabs.io/docs/api-reference/text-to-speech/convert
 */

export interface ElevenLabsVoice {
  voiceId: string;
  name: string;
  category?: string;
  description?: string;
  previewUrl?: string;
}

export class ElevenLabsServiceError extends Error {
  public readonly status?: number;

  constructor(message: string, status?: number) {
    super(message);
    this.name = 'ElevenLabsServiceError';
    this.status = status;
  }
}

/** Flash model uses fewer credits on free/self-serve plans. */
export const DEFAULT_ELEVENLABS_MODEL = 'eleven_flash_v2_5';

/** Common default premade voice (Rachel) — used until the user picks one. */
export const DEFAULT_ELEVENLABS_VOICE_ID = '21m00Tcm4TlvDq8ikWAM';

/**
 * Curated free/premade voices for when the API key lacks `voices_read`
 * (restricted keys often only grant Text to Speech). TTS still works with these IDs.
 */
export const CURATED_ELEVENLABS_VOICES: ElevenLabsVoice[] = [
  {
    voiceId: '21m00Tcm4TlvDq8ikWAM',
    name: 'Rachel',
    category: 'premade',
    description: 'Calm, clear American female — great for narration'
  },
  {
    voiceId: 'AZnzlk1XvdvUeBnXmlld',
    name: 'Domi',
    category: 'premade',
    description: 'Strong, confident young American female'
  },
  {
    voiceId: 'EXAVITQu4vr4xnSDxMaL',
    name: 'Sarah',
    category: 'premade',
    description: 'Soft, soft-spoken American female'
  },
  {
    voiceId: 'ErXwobaYiN019PkySvjV',
    name: 'Antoni',
    category: 'premade',
    description: 'Well-rounded, friendly American male'
  },
  {
    voiceId: 'MF3mGyEYCl7XYWbV9V6O',
    name: 'Elli',
    category: 'premade',
    description: 'Emotional, expressive young American female'
  },
  {
    voiceId: 'TxGEqnHWrfWFTfGW9XjX',
    name: 'Josh',
    category: 'premade',
    description: 'Deep, young American male'
  },
  {
    voiceId: 'VR6AewLTigWG4xSOukaG',
    name: 'Arnold',
    category: 'premade',
    description: 'Crisp, middle-aged American male'
  },
  {
    voiceId: 'pNInz6obpgDQGcFmaJgB',
    name: 'Adam',
    category: 'premade',
    description: 'Deep, narrative American male'
  },
  {
    voiceId: 'yoZ06aMxZJJ28mfd3POQ',
    name: 'Sam',
    category: 'premade',
    description: 'Raspy, young American male'
  },
  {
    voiceId: 'JBFqnCBsd6RMkjVDRZzb',
    name: 'George',
    category: 'premade',
    description: 'Warm, British male — easy listening'
  },
  {
    voiceId: 'onwK4e9ZLuTAKqWW03F9',
    name: 'Daniel',
    category: 'premade',
    description: 'Authoritative British male newsreader style'
  },
  {
    voiceId: 'XB0fDUnXU5powFXDhCwa',
    name: 'Charlotte',
    category: 'premade',
    description: 'Seductive Swedish female English'
  },
  {
    voiceId: 'XrExE9yKIg1WjnnlVkGX',
    name: 'Matilda',
    category: 'premade',
    description: 'Warm, friendly American female'
  },
  {
    voiceId: 'N2lVS1w4EtoT3dr4eOWO',
    name: 'Callum',
    category: 'premade',
    description: 'Intense, husky American male'
  },
  {
    voiceId: 'IKne3meq5aSn9XLyUdCD',
    name: 'Charlie',
    category: 'premade',
    description: 'Casual, natural Australian male'
  },
  {
    voiceId: 'cgSgspJ2msmBaCrSLipa',
    name: 'Jessica',
    category: 'premade',
    description: 'Expressive, playful American female'
  },
  {
    voiceId: 'FGY2WhTYpPnrIDTdsKH5',
    name: 'Laura',
    category: 'premade',
    description: 'Upbeat, enthusiastic American female'
  },
  {
    voiceId: 'TX3LPaxmHKxFdv7VOQHJ',
    name: 'Liam',
    category: 'premade',
    description: 'Articulate young American male'
  },
  {
    voiceId: 'bIHbv24MWmeRgasZH58o',
    name: 'Will',
    category: 'premade',
    description: 'Friendly, conversational American male'
  },
  {
    voiceId: 'nPczCjzI2devNBz1zQrb',
    name: 'Brian',
    category: 'premade',
    description: 'Deep, resonant American male'
  }
].slice().sort((a, b) => a.name.localeCompare(b.name, undefined, { sensitivity: 'base' }));

export interface ElevenLabsVoiceListResult {
  voices: ElevenLabsVoice[];
  /** True when the live /v1/voices call failed and curated free voices were used instead. */
  usedCuratedFallback: boolean;
  fallbackReason?: string;
}

function apiKeyHeader(apiKey: string): Record<string, string> {
  return {
    'xi-api-key': apiKey.trim(),
    Accept: 'application/json'
  };
}

function parseElevenLabsErrorMessage(status: number, bodyText: string): string {
  let message = `ElevenLabs request failed (${status})`;
  try {
    const body = JSON.parse(bodyText) as {
      detail?: { message?: string; status?: string } | string;
    };
    if (typeof body.detail === 'string') message = body.detail;
    else if (body.detail && typeof body.detail === 'object' && body.detail.message) {
      message = body.detail.message;
    }
  } catch {
    /* ignore */
  }
  return message;
}

export async function listElevenLabsVoices(apiKey: string): Promise<ElevenLabsVoice[]> {
  const key = (apiKey || '').trim();
  if (!key) throw new ElevenLabsServiceError('ElevenLabs API key is not set.');

  const resp = await fetch('https://api.elevenlabs.io/v1/voices', {
    method: 'GET',
    headers: apiKeyHeader(key)
  });
  if (!resp.ok) {
    const message = parseElevenLabsErrorMessage(resp.status, await resp.text());
    throw new ElevenLabsServiceError(message, resp.status);
  }

  const data = (await resp.json()) as {
    voices?: Array<{
      voice_id?: string;
      name?: string;
      category?: string;
      description?: string;
      preview_url?: string;
    }>;
  };

  const out: ElevenLabsVoice[] = [];
  for (const v of data.voices ?? []) {
    const voiceId = (v.voice_id || '').trim();
    const name = (v.name || '').trim();
    if (!voiceId || !name) continue;
    out.push({
      voiceId,
      name,
      category: (v.category || '').trim() || undefined,
      description: (v.description || '').trim() || undefined,
      previewUrl: (v.preview_url || '').trim() || undefined
    });
  }
  out.sort((a, b) => a.name.localeCompare(b.name, undefined, { sensitivity: 'base' }));
  return out;
}

/**
 * Prefer the live voice library; if the key lacks `voices_read`, return curated free voices
 * so Text to Speech–only restricted keys still work in Travel Hub.
 */
export async function listElevenLabsVoicesWithFallback(apiKey: string): Promise<ElevenLabsVoiceListResult> {
  try {
    const voices = await listElevenLabsVoices(apiKey);
    return { voices, usedCuratedFallback: false };
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Could not load ElevenLabs voices.';
    const needsVoicesRead = /voices_read|missing the permission/i.test(message);
    if (needsVoicesRead || (err instanceof ElevenLabsServiceError && err.status === 401)) {
      return {
        voices: CURATED_ELEVENLABS_VOICES,
        usedCuratedFallback: true,
        fallbackReason: needsVoicesRead
          ? 'Restricted key cannot list the full voice library (needs Voices → Read). Showing free premade voices instead — Text to Speech alone is enough to use them.'
          : message
      };
    }
    throw err;
  }
}

export async function synthesizeElevenLabsSpeech(options: {
  apiKey: string;
  voiceId: string;
  text: string;
  modelId?: string;
}): Promise<Blob> {
  const key = (options.apiKey || '').trim();
  const voiceId = (options.voiceId || '').trim() || DEFAULT_ELEVENLABS_VOICE_ID;
  const text = (options.text || '').trim();
  if (!key) throw new ElevenLabsServiceError('ElevenLabs API key is not set.');
  if (!text) throw new ElevenLabsServiceError('Nothing to speak.');

  const modelId = (options.modelId || DEFAULT_ELEVENLABS_MODEL).trim();
  const url = `https://api.elevenlabs.io/v1/text-to-speech/${encodeURIComponent(voiceId)}`;
  const resp = await fetch(url, {
    method: 'POST',
    headers: {
      ...apiKeyHeader(key),
      Accept: 'audio/mpeg',
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      text,
      model_id: modelId,
      voice_settings: {
        stability: 0.45,
        similarity_boost: 0.75
      }
    })
  });

  if (!resp.ok) {
    const message = parseElevenLabsErrorMessage(resp.status, await resp.text());
    throw new ElevenLabsServiceError(message, resp.status);
  }

  return resp.blob();
}
