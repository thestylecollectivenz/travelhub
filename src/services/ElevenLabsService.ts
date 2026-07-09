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

function apiKeyHeader(apiKey: string): Record<string, string> {
  return {
    'xi-api-key': apiKey.trim(),
    Accept: 'application/json'
  };
}

export async function listElevenLabsVoices(apiKey: string): Promise<ElevenLabsVoice[]> {
  const key = (apiKey || '').trim();
  if (!key) throw new ElevenLabsServiceError('ElevenLabs API key is not set.');

  const resp = await fetch('https://api.elevenlabs.io/v1/voices', {
    method: 'GET',
    headers: apiKeyHeader(key)
  });
  if (!resp.ok) {
    let message = `ElevenLabs voices request failed (${resp.status})`;
    try {
      const body = (await resp.json()) as { detail?: { message?: string } | string };
      if (typeof body.detail === 'string') message = body.detail;
      else if (body.detail && typeof body.detail === 'object' && body.detail.message) {
        message = body.detail.message;
      }
    } catch {
      /* ignore */
    }
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
    let message = `ElevenLabs speech request failed (${resp.status})`;
    try {
      const body = (await resp.json()) as { detail?: { message?: string } | string };
      if (typeof body.detail === 'string') message = body.detail;
      else if (body.detail && typeof body.detail === 'object' && body.detail.message) {
        message = body.detail.message;
      }
    } catch {
      /* ignore */
    }
    throw new ElevenLabsServiceError(message, resp.status);
  }

  return resp.blob();
}
