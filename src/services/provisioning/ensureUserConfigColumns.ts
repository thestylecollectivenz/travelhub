import { WebPartContext } from '@microsoft/sp-webpart-base';
import { ensureSharePointList } from './sharePointListProvisioning';

/**
 * Append-only UserConfig columns. Ensures API keys and prefs can sync across devices
 * via SharePoint (not localStorage-only).
 */
export async function ensureUserConfigColumns(ctx: WebPartContext): Promise<void> {
  await ensureSharePointList(ctx, 'UserConfig', [
    { internalName: 'UserId', type: 'Text' },
    { internalName: 'HomeCurrency', type: 'Text' },
    { internalName: 'TemperatureUnit', type: 'Text' },
    { internalName: 'DistanceUnit', type: 'Text' },
    { internalName: 'DateFormat', type: 'Text' },
    { internalName: 'ShowTravellerNames', type: 'Boolean' },
    { internalName: 'JournalAuthorName', type: 'Text' },
    { internalName: 'SidebarWidth', type: 'Number' },
    { internalName: 'SidebarWidthCustomized', type: 'Boolean' },
    { internalName: 'WeatherApiKey', type: 'Text' },
    { internalName: 'GeminiApiKey', type: 'Text' },
    { internalName: 'GoogleMapsApiKey', type: 'Text' },
    { internalName: 'ElevenLabsApiKey', type: 'Text' },
    { internalName: 'ElevenLabsVoiceId', type: 'Text' },
    { internalName: 'SpeechEngine', type: 'Text' },
    { internalName: 'BrowserVoiceURI', type: 'Text' },
    { internalName: 'DayBreakdownVisibleByDefault', type: 'Boolean' }
  ]);
}
