import { WebPartContext } from '@microsoft/sp-webpart-base';
import { SPHttpClient, SPHttpClientResponse } from '@microsoft/sp-http';
import { getCurrentUserEmail } from '../utils/currentUserEmail';
import { ensureUserConfigColumns } from './provisioning/ensureUserConfigColumns';

const LIST = 'UserConfig';

export interface UserConfig {
  homeCurrency: string;
  temperatureUnit: 'Celsius' | 'Fahrenheit';
  distanceUnit: 'Kilometres' | 'Miles';
  /** Trip day dates in journal: DD/MM/YYYY (DMY) or MM/DD/YYYY (MDY). */
  dateFormat: 'DMY' | 'MDY';
  showTravellerNames: boolean;
  /** Stored display name for new journal entries; empty = use M365 display name at write time. */
  journalAuthorName: string;
  /** Persisted workspace sidebar width (px). */
  sidebarWidth: number;
  /** When true, use `sidebarWidth`; otherwise auto-fit to icon tab strip. */
  sidebarWidthCustomized?: boolean;
  weatherApiKey: string;
  geminiApiKey: string;
  /** ElevenLabs API key for AI read-out voices (free plan supported). */
  elevenLabsApiKey: string;
  /** Selected ElevenLabs voice_id; empty = default premade voice. */
  elevenLabsVoiceId: string;
  /** Read-out engine: free browser voices by default; ElevenLabs only when chosen. */
  speechEngine: 'browser' | 'elevenlabs';
  /** Browser speechSynthesis voiceURI (or name); empty = auto-pick most natural English voice. */
  browserVoiceURI: string;
  /** When false, day budget breakdown starts collapsed on each day. */
  dayBreakdownVisibleByDefault: boolean;
}

export const DEFAULT_USER_CONFIG: UserConfig = {
  homeCurrency: 'NZD',
  temperatureUnit: 'Celsius',
  distanceUnit: 'Kilometres',
  dateFormat: 'DMY',
  showTravellerNames: true,
  journalAuthorName: '',
  sidebarWidth: 260,
  weatherApiKey: '',
  geminiApiKey: '',
  elevenLabsApiKey: '',
  elevenLabsVoiceId: '',
  speechEngine: 'browser',
  browserVoiceURI: '',
  dayBreakdownVisibleByDefault: true
};

const FULL_SELECT =
  'ID,Title,UserId,HomeCurrency,TemperatureUnit,DistanceUnit,DateFormat,ShowTravellerNames,JournalAuthorName,SidebarWidth,SidebarWidthCustomized,WeatherApiKey,GeminiApiKey,ElevenLabsApiKey,ElevenLabsVoiceId,SpeechEngine,BrowserVoiceURI,DayBreakdownVisibleByDefault';

async function logFailedResponse(label: string, resp: SPHttpClientResponse): Promise<string> {
  let body = '';
  try {
    body = await resp.text();
  } catch {
    body = '(could not read body)';
  }
  // eslint-disable-next-line no-console
  console.error(`ConfigService ${label} failed`, { status: resp.status, statusText: resp.statusText, body });
  return body;
}

/** Stable cross-device identity for UserConfig rows. */
export function resolveUserConfigKey(ctx: WebPartContext, preferred?: string): string {
  const email = (preferred || getCurrentUserEmail(ctx) || '').trim().toLowerCase();
  if (email && email.includes('@')) return email;
  const login = (ctx.pageContext.user.loginName || '').trim().toLowerCase();
  return login || email || 'unknown-user';
}

export class ConfigService {
  private ctx: WebPartContext;
  private baseUrl: string;

  constructor(context: WebPartContext) {
    this.ctx = context;
    this.baseUrl = `${context.pageContext.web.absoluteUrl}/_api/web/lists/getbytitle('${LIST}')/items`;
  }

  private mapFromSpItem(item: Record<string, unknown>): UserConfig {
    return {
      homeCurrency: (item.HomeCurrency as string) || DEFAULT_USER_CONFIG.homeCurrency,
      temperatureUnit: item.TemperatureUnit === 'Fahrenheit' ? 'Fahrenheit' : 'Celsius',
      distanceUnit: item.DistanceUnit === 'Miles' ? 'Miles' : 'Kilometres',
      dateFormat: item.DateFormat === 'MDY' ? 'MDY' : 'DMY',
      showTravellerNames:
        typeof item.ShowTravellerNames === 'boolean'
          ? item.ShowTravellerNames
          : DEFAULT_USER_CONFIG.showTravellerNames,
      journalAuthorName: typeof item.JournalAuthorName === 'string' ? item.JournalAuthorName : '',
      sidebarWidth:
        typeof item.SidebarWidth === 'number'
          ? item.SidebarWidth
          : Number(item.SidebarWidth ?? DEFAULT_USER_CONFIG.sidebarWidth) || DEFAULT_USER_CONFIG.sidebarWidth,
      sidebarWidthCustomized:
        typeof item.SidebarWidthCustomized === 'boolean' ? item.SidebarWidthCustomized : false,
      weatherApiKey: typeof item.WeatherApiKey === 'string' ? item.WeatherApiKey : '',
      geminiApiKey: typeof item.GeminiApiKey === 'string' ? item.GeminiApiKey : '',
      elevenLabsApiKey: typeof item.ElevenLabsApiKey === 'string' ? item.ElevenLabsApiKey : '',
      elevenLabsVoiceId: typeof item.ElevenLabsVoiceId === 'string' ? item.ElevenLabsVoiceId : '',
      speechEngine: item.SpeechEngine === 'elevenlabs' ? 'elevenlabs' : 'browser',
      browserVoiceURI: typeof item.BrowserVoiceURI === 'string' ? item.BrowserVoiceURI : '',
      dayBreakdownVisibleByDefault:
        typeof item.DayBreakdownVisibleByDefault === 'boolean'
          ? item.DayBreakdownVisibleByDefault
          : DEFAULT_USER_CONFIG.dayBreakdownVisibleByDefault
    };
  }

  private mapToSpItem(userKey: string, config: UserConfig): Record<string, unknown> {
    return {
      Title: userKey,
      UserId: userKey,
      HomeCurrency: config.homeCurrency,
      TemperatureUnit: config.temperatureUnit,
      DistanceUnit: config.distanceUnit,
      DateFormat: config.dateFormat,
      ShowTravellerNames: config.showTravellerNames,
      JournalAuthorName: config.journalAuthorName ?? '',
      SidebarWidth: typeof config.sidebarWidth === 'number' ? config.sidebarWidth : DEFAULT_USER_CONFIG.sidebarWidth,
      SidebarWidthCustomized: config.sidebarWidthCustomized === true,
      WeatherApiKey: config.weatherApiKey ?? '',
      GeminiApiKey: config.geminiApiKey ?? '',
      ElevenLabsApiKey: config.elevenLabsApiKey ?? '',
      ElevenLabsVoiceId: config.elevenLabsVoiceId ?? '',
      SpeechEngine: config.speechEngine === 'elevenlabs' ? 'elevenlabs' : 'browser',
      BrowserVoiceURI: config.browserVoiceURI ?? '',
      DayBreakdownVisibleByDefault: config.dayBreakdownVisibleByDefault
    };
  }

  private async queryByField(field: 'UserId' | 'Title', value: string): Promise<SPHttpClientResponse> {
    const safe = value.replace(/'/g, "''");
    const filter = encodeURIComponent(`${field} eq '${safe}'`);
    const select = encodeURIComponent(FULL_SELECT);
    const url = `${this.baseUrl}?$select=${select}&$filter=${filter}&$top=5`;
    return this.ctx.spHttpClient.get(url, SPHttpClient.configurations.v1);
  }

  private async findConfigItem(
    userKey: string
  ): Promise<{ id?: number; config: UserConfig; raw?: Record<string, unknown> }> {
    const candidates = new Set<string>();
    candidates.add(userKey);
    const login = (this.ctx.pageContext.user.loginName || '').trim().toLowerCase();
    if (login) candidates.add(login);
    const email = getCurrentUserEmail(this.ctx);
    if (email) candidates.add(email);

    let firstOkEmpty = false;
    for (const key of Array.from(candidates)) {
      for (const field of ['UserId', 'Title'] as const) {
        let resp: SPHttpClientResponse;
        try {
          // eslint-disable-next-line no-await-in-loop
          resp = await this.queryByField(field, key);
        } catch (err) {
          // eslint-disable-next-line no-console
          console.error('ConfigService.findConfigItem query threw', field, key, err);
          continue;
        }
        if (resp.status === 400 || resp.status === 404) {
          // eslint-disable-next-line no-await-in-loop
          await logFailedResponse(`findConfigItem ${field}`, resp);
          continue;
        }
        if (!resp.ok) {
          // eslint-disable-next-line no-await-in-loop
          await logFailedResponse(`findConfigItem ${field}`, resp);
          continue;
        }
        // eslint-disable-next-line no-await-in-loop
        const data = (await resp.json()) as { value?: Record<string, unknown>[] };
        const item = (data.value ?? [])[0];
        if (!item) {
          firstOkEmpty = true;
          continue;
        }
        return { id: Number(item.ID), config: this.mapFromSpItem(item), raw: item };
      }
    }

    if (firstOkEmpty) {
      return { config: { ...DEFAULT_USER_CONFIG } };
    }
    return { config: { ...DEFAULT_USER_CONFIG } };
  }

  async getConfig(userKey?: string): Promise<UserConfig> {
    const key = resolveUserConfigKey(this.ctx, userKey);
    const row = await this.findConfigItem(key);
    return row.config;
  }

  private parseMissingProperty(errorBody: string): string | undefined {
    const match = errorBody.match(/The property '([^']+)' does not exist/i);
    return match?.[1];
  }

  private async writePayload(
    existingId: number | undefined,
    payload: Record<string, unknown>
  ): Promise<{ ok: boolean; status: number; body: string }> {
    if (existingId) {
      const updateResp = await this.ctx.spHttpClient.fetch(
        `${this.baseUrl}(${existingId})`,
        SPHttpClient.configurations.v1,
        {
          method: 'PATCH',
          headers: {
            Accept: 'application/json;odata.metadata=minimal',
            'Content-Type': 'application/json;odata.metadata=minimal',
            'IF-MATCH': '*'
          },
          body: JSON.stringify(payload)
        }
      );
      if (updateResp.ok || updateResp.status === 204) {
        return { ok: true, status: updateResp.status, body: '' };
      }
      const body = await logFailedResponse('saveConfig PATCH', updateResp);
      return { ok: false, status: updateResp.status, body };
    }

    const createResp = await this.ctx.spHttpClient.post(this.baseUrl, SPHttpClient.configurations.v1, {
      headers: {
        Accept: 'application/json;odata.metadata=minimal',
        'Content-Type': 'application/json;odata.metadata=minimal'
      },
      body: JSON.stringify(payload)
    });
    if (createResp.ok || createResp.status === 201) {
      return { ok: true, status: createResp.status, body: '' };
    }
    const body = await logFailedResponse('saveConfig POST', createResp);
    return { ok: false, status: createResp.status, body };
  }

  /**
   * Saves to SharePoint only. Ensures UserConfig columns when possible, then retries
   * while stripping fields SharePoint reports as missing (append-only schema lag).
   */
  async saveConfig(userKey: string | undefined, config: UserConfig): Promise<void> {
    const key = resolveUserConfigKey(this.ctx, userKey);

    try {
      await ensureUserConfigColumns(this.ctx);
    } catch (err) {
      // eslint-disable-next-line no-console
      console.warn('ConfigService: ensureUserConfigColumns failed (will retry save with available columns).', err);
    }

    const existing = await this.findConfigItem(key);
    let payload = this.mapToSpItem(key, config);
    const stripped: string[] = [];
    let lastStatus = 0;
    let lastBody = '';

    for (let attempt = 0; attempt < 24; attempt++) {
      // eslint-disable-next-line no-await-in-loop
      const result = await this.writePayload(existing.id, payload);
      if (result.ok) {
        if (existing.id && existing.raw) {
          const prevUserId = String(existing.raw.UserId ?? '').trim().toLowerCase();
          const prevTitle = String(existing.raw.Title ?? '').trim().toLowerCase();
          if (prevUserId !== key || prevTitle !== key) {
            await this.ctx.spHttpClient.fetch(`${this.baseUrl}(${existing.id})`, SPHttpClient.configurations.v1, {
              method: 'PATCH',
              headers: {
                Accept: 'application/json;odata.metadata=minimal',
                'Content-Type': 'application/json;odata.metadata=minimal',
                'IF-MATCH': '*'
              },
              body: JSON.stringify({ Title: key, UserId: key })
            });
          }
        }
        if (stripped.length) {
          // eslint-disable-next-line no-console
          console.warn(
            'ConfigService: saved without columns not yet on UserConfig list:',
            stripped.join(', ')
          );
        }
        return;
      }

      lastStatus = result.status;
      lastBody = result.body;
      if (result.status !== 400) break;

      const missing = this.parseMissingProperty(result.body);
      if (!missing || !(missing in payload) || missing === 'Title' || missing === 'UserId') {
        break;
      }
      delete payload[missing];
      stripped.push(missing);
      payload = { ...payload };
    }

    throw new Error(
      `Could not save settings to SharePoint (${lastStatus}). ${lastBody.slice(0, 220)}`
    );
  }
}
