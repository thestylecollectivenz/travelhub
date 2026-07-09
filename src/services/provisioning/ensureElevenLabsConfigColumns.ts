import { WebPartContext } from '@microsoft/sp-webpart-base';
import { ensureSharePointList } from './sharePointListProvisioning';

/** Append-only UserConfig columns for ElevenLabs TTS (free-plan API). */
export async function ensureElevenLabsConfigColumns(ctx: WebPartContext): Promise<void> {
  await ensureSharePointList(ctx, 'UserConfig', [
    { internalName: 'ElevenLabsApiKey', type: 'Text' },
    { internalName: 'ElevenLabsVoiceId', type: 'Text' }
  ]);
}
