import { WebPartContext } from '@microsoft/sp-webpart-base';
import { ensureSharePointList } from './sharePointListProvisioning';

/** Append-only UserConfig columns for speech / ElevenLabs TTS settings. */
export async function ensureElevenLabsConfigColumns(ctx: WebPartContext): Promise<void> {
  await ensureSharePointList(ctx, 'UserConfig', [
    { internalName: 'ElevenLabsApiKey', type: 'Text' },
    { internalName: 'ElevenLabsVoiceId', type: 'Text' },
    { internalName: 'SpeechEngine', type: 'Text' },
    { internalName: 'BrowserVoiceURI', type: 'Text' }
  ]);
}
