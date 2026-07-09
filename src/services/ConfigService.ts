import { WebPartContext } from '@microsoft/sp-webpart-base';
import { SPHttpClient, SPHttpClientResponse } from '@microsoft/sp-http';

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

async function logFailedResponse(label: string, resp: SPHttpClientResponse): Promise<void> {
  let body = '';
  try {
    body = await resp.text();
  } catch {
    body = '(could not read body)';
  }
  // eslint-disable-next-line no-console
  console.error(`ConfigService ${label} failed`, { status: resp.status, statusText: resp.statusText, body });
}

export class ConfigService {
  private ctx: WebPartContext;
  private baseUrl: string;
  private localStorageKeyPrefix: string;

  constructor(context: WebPartContext) {
    this.ctx = context;
    this.baseUrl = `${context.pageContext.web.absoluteUrl}/_api/web/lists/getbytitle('${LIST}')/items`;
    this.localStorageKeyPrefix = `travelhub:userconfig:${context.pageContext.web.absoluteUrl}`;
  }

  private localStorageKey(userId: string): string {
    return `${this.localStorageKeyPrefix}:${userId}`;
  }

  private loadFromLocalFallback(userId: string): UserConfig | undefined {
    try {
      const raw = window.localStorage.getItem(this.localStorageKey(userId));
      if (!raw) return undefined;
      const parsed = JSON.parse(raw) as Partial<UserConfig>;
      return {
        ...DEFAULT_USER_CONFIG,
        ...parsed,
        sidebarWidth:
          typeof parsed.sidebarWidth === 'number'
            ? parsed.sidebarWidth
            : Number(parsed.sidebarWidth ?? DEFAULT_USER_CONFIG.sidebarWidth) || DEFAULT_USER_CONFIG.sidebarWidth,
        sidebarWidthCustomized: parsed.sidebarWidthCustomized === true,
        dayBreakdownVisibleByDefault:
          typeof parsed.dayBreakdownVisibleByDefault === 'boolean'
            ? parsed.dayBreakdownVisibleByDefault
            : DEFAULT_USER_CONFIG.dayBreakdownVisibleByDefault,
        dateFormat: parsed.dateFormat === 'MDY' ? 'MDY' : DEFAULT_USER_CONFIG.dateFormat,
        speechEngine: parsed.speechEngine === 'elevenlabs' ? 'elevenlabs' : 'browser',
        browserVoiceURI: typeof parsed.browserVoiceURI === 'string' ? parsed.browserVoiceURI : ''
      };
    } catch {
      return undefined;
    }
  }

  private saveToLocalFallback(userId: string, config: UserConfig): void {
    try {
      window.localStorage.setItem(this.localStorageKey(userId), JSON.stringify(config));
    } catch {
      // Ignore quota/privacy mode errors.
    }
  }

  private hasOwnField(item: Record<string, unknown>, fieldName: string): boolean {
    return Object.prototype.hasOwnProperty.call(item, fieldName);
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

  private mapToSpItem(userId: string, config: UserConfig): Record<string, unknown> {
    return {
      Title: userId,
      UserId: userId,
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

  private mergeWithLocalFallback(
    item: Record<string, unknown>,
    mapped: UserConfig,
    localFallback?: UserConfig
  ): UserConfig {
    if (!localFallback) {
      return mapped;
    }

    return {
      homeCurrency: this.hasOwnField(item, 'HomeCurrency') ? mapped.homeCurrency : localFallback.homeCurrency,
      temperatureUnit: this.hasOwnField(item, 'TemperatureUnit') ? mapped.temperatureUnit : localFallback.temperatureUnit,
      distanceUnit: this.hasOwnField(item, 'DistanceUnit') ? mapped.distanceUnit : localFallback.distanceUnit,
      dateFormat: this.hasOwnField(item, 'DateFormat') ? mapped.dateFormat : localFallback.dateFormat,
      showTravellerNames: this.hasOwnField(item, 'ShowTravellerNames')
        ? mapped.showTravellerNames
        : localFallback.showTravellerNames,
      journalAuthorName: this.hasOwnField(item, 'JournalAuthorName')
        ? mapped.journalAuthorName
        : localFallback.journalAuthorName,
      sidebarWidth: this.hasOwnField(item, 'SidebarWidth') ? mapped.sidebarWidth : localFallback.sidebarWidth,
      sidebarWidthCustomized: this.hasOwnField(item, 'SidebarWidthCustomized')
        ? mapped.sidebarWidthCustomized
        : localFallback.sidebarWidthCustomized,
      weatherApiKey: this.hasOwnField(item, 'WeatherApiKey') ? mapped.weatherApiKey : localFallback.weatherApiKey,
      geminiApiKey: this.hasOwnField(item, 'GeminiApiKey') ? mapped.geminiApiKey : localFallback.geminiApiKey,
      elevenLabsApiKey: this.hasOwnField(item, 'ElevenLabsApiKey')
        ? mapped.elevenLabsApiKey
        : localFallback.elevenLabsApiKey,
      elevenLabsVoiceId: this.hasOwnField(item, 'ElevenLabsVoiceId')
        ? mapped.elevenLabsVoiceId
        : localFallback.elevenLabsVoiceId,
      speechEngine: this.hasOwnField(item, 'SpeechEngine') ? mapped.speechEngine : localFallback.speechEngine,
      browserVoiceURI: this.hasOwnField(item, 'BrowserVoiceURI')
        ? mapped.browserVoiceURI
        : localFallback.browserVoiceURI,
      dayBreakdownVisibleByDefault: this.hasOwnField(item, 'DayBreakdownVisibleByDefault')
        ? mapped.dayBreakdownVisibleByDefault
        : localFallback.dayBreakdownVisibleByDefault
    };
  }

  private async getItemsWithFilter(filterExpr: string, includeUserIdField: boolean): Promise<SPHttpClientResponse> {
    const safeFilter = encodeURIComponent(filterExpr);
    const selects = includeUserIdField
      ? [
          'ID,Title,UserId,HomeCurrency,TemperatureUnit,DistanceUnit,DateFormat,ShowTravellerNames,JournalAuthorName,SidebarWidth,SidebarWidthCustomized,WeatherApiKey,GeminiApiKey,ElevenLabsApiKey,ElevenLabsVoiceId,SpeechEngine,BrowserVoiceURI,DayBreakdownVisibleByDefault',
          'ID,Title,UserId,HomeCurrency,TemperatureUnit,DistanceUnit,DateFormat,ShowTravellerNames,JournalAuthorName,SidebarWidth,SidebarWidthCustomized,WeatherApiKey,GeminiApiKey,ElevenLabsApiKey,ElevenLabsVoiceId,DayBreakdownVisibleByDefault',
          'ID,Title,UserId,HomeCurrency,TemperatureUnit,DistanceUnit,DateFormat,ShowTravellerNames,JournalAuthorName,SidebarWidth,SidebarWidthCustomized,WeatherApiKey,GeminiApiKey,DayBreakdownVisibleByDefault',
          'ID,Title,UserId,HomeCurrency,TemperatureUnit,DistanceUnit,ShowTravellerNames,JournalAuthorName,SidebarWidth,SidebarWidthCustomized,WeatherApiKey,GeminiApiKey,DayBreakdownVisibleByDefault'
        ]
      : [
          'ID,Title,HomeCurrency,TemperatureUnit,DistanceUnit,DateFormat,ShowTravellerNames,JournalAuthorName,SidebarWidth,SidebarWidthCustomized,WeatherApiKey,GeminiApiKey,ElevenLabsApiKey,ElevenLabsVoiceId,SpeechEngine,BrowserVoiceURI,DayBreakdownVisibleByDefault',
          'ID,Title,HomeCurrency,TemperatureUnit,DistanceUnit,DateFormat,ShowTravellerNames,JournalAuthorName,SidebarWidth,SidebarWidthCustomized,WeatherApiKey,GeminiApiKey,ElevenLabsApiKey,ElevenLabsVoiceId,DayBreakdownVisibleByDefault',
          'ID,Title,HomeCurrency,TemperatureUnit,DistanceUnit,DateFormat,ShowTravellerNames,JournalAuthorName,SidebarWidth,SidebarWidthCustomized,WeatherApiKey,GeminiApiKey,DayBreakdownVisibleByDefault',
          'ID,Title,HomeCurrency,TemperatureUnit,DistanceUnit,ShowTravellerNames,JournalAuthorName,SidebarWidth,SidebarWidthCustomized,WeatherApiKey,GeminiApiKey,DayBreakdownVisibleByDefault'
        ];
    let lastResp: SPHttpClientResponse | undefined;
    for (const selectFields of selects) {
      const select = encodeURIComponent(selectFields);
      const url = `${this.baseUrl}?$select=${select}&$filter=${safeFilter}&$top=1`;
      // eslint-disable-next-line no-await-in-loop
      const resp = await this.ctx.spHttpClient.get(url, SPHttpClient.configurations.v1);
      if (resp.ok) {
        return resp;
      }
      lastResp = resp;
      if (resp.status !== 400 && resp.status !== 404) {
        break;
      }
    }
    return lastResp ?? (await this.ctx.spHttpClient.get(`${this.baseUrl}?$top=0`, SPHttpClient.configurations.v1));
  }

  private async getConfigItem(userId: string): Promise<{ id?: number; config: UserConfig; raw?: Record<string, unknown> }> {
    const safeUserId = userId.replace(/'/g, "''");
    let resp: SPHttpClientResponse;
    try {
      resp = await this.getItemsWithFilter(`UserId eq '${safeUserId}'`, true);
    } catch (err) {
      // eslint-disable-next-line no-console
      console.error('ConfigService.getConfigItem UserId query threw', err);
      return { config: this.loadFromLocalFallback(userId) ?? { ...DEFAULT_USER_CONFIG } };
    }
    if (resp.status === 400 || resp.status === 406) {
      await logFailedResponse('getConfigItem UserId filter (will try Title fallback)', resp);
      try {
        resp = await this.getItemsWithFilter(`Title eq '${safeUserId}'`, false);
      } catch (err) {
        // eslint-disable-next-line no-console
        console.error('ConfigService.getConfigItem Title query threw', err);
        return { config: this.loadFromLocalFallback(userId) ?? { ...DEFAULT_USER_CONFIG } };
      }
    }
    if (!resp.ok) {
      await logFailedResponse('getConfigItem', resp);
      return { config: this.loadFromLocalFallback(userId) ?? { ...DEFAULT_USER_CONFIG } };
    }
    let data: { value?: Record<string, unknown>[] };
    try {
      data = await resp.json();
    } catch (err) {
      // eslint-disable-next-line no-console
      console.error('ConfigService.getConfigItem JSON parse', err);
      return { config: this.loadFromLocalFallback(userId) ?? { ...DEFAULT_USER_CONFIG } };
    }
    const item = (data.value ?? [])[0];
    if (!item) {
      return { config: this.loadFromLocalFallback(userId) ?? { ...DEFAULT_USER_CONFIG } };
    }
    const localFallback = this.loadFromLocalFallback(userId);
    const resolved = this.mergeWithLocalFallback(item, this.mapFromSpItem(item), localFallback);
    this.saveToLocalFallback(userId, resolved);
    return { id: Number(item.ID), config: resolved, raw: item };
  }

  async getConfig(userId: string): Promise<UserConfig> {
    const row = await this.getConfigItem(userId);
    return row.config;
  }

  async saveConfig(userId: string, config: UserConfig): Promise<void> {
    const existing = await this.getConfigItem(userId);
    const fullBody = this.mapToSpItem(userId, config);
    const bodies: Record<string, unknown>[] = [
      fullBody,
      // Fallback if newer speech columns are not yet provisioned on the list.
      (() => {
        const without = { ...fullBody };
        delete without.SpeechEngine;
        delete without.BrowserVoiceURI;
        return without;
      })(),
      (() => {
        const without = { ...fullBody };
        delete without.SpeechEngine;
        delete without.BrowserVoiceURI;
        delete without.ElevenLabsApiKey;
        delete without.ElevenLabsVoiceId;
        return without;
      })()
    ];

    if (existing.id) {
      let lastErr: SPHttpClientResponse | undefined;
      for (const payload of bodies) {
        const updateResp = await this.ctx.spHttpClient.fetch(`${this.baseUrl}(${existing.id})`, SPHttpClient.configurations.v1, {
          method: 'PATCH',
          headers: {
            Accept: 'application/json;odata.metadata=minimal',
            'Content-Type': 'application/json;odata.metadata=minimal',
            'IF-MATCH': '*'
          },
          body: JSON.stringify(payload)
        });
        if (updateResp.ok || updateResp.status === 204) {
          this.saveToLocalFallback(userId, config);
          return;
        }
        lastErr = updateResp;
        if (updateResp.status !== 400) break;
      }
      if (lastErr) await logFailedResponse('saveConfig PATCH', lastErr);
      this.saveToLocalFallback(userId, config);
      return;
    }

    let lastCreate: SPHttpClientResponse | undefined;
    for (const payload of bodies) {
      const createResp = await this.ctx.spHttpClient.post(this.baseUrl, SPHttpClient.configurations.v1, {
        headers: {
          Accept: 'application/json;odata.metadata=minimal',
          'Content-Type': 'application/json;odata.metadata=minimal'
        },
        body: JSON.stringify(payload)
      });
      if (createResp.ok || createResp.status === 201) {
        this.saveToLocalFallback(userId, config);
        return;
      }
      lastCreate = createResp;
      if (createResp.status !== 400) break;
    }
    if (lastCreate) await logFailedResponse('saveConfig POST', lastCreate);
    this.saveToLocalFallback(userId, config);
  }
}

