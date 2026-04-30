import { WebPartContext } from '@microsoft/sp-webpart-base';
import { SPHttpClient, SPHttpClientResponse } from '@microsoft/sp-http';

const LIST = 'UserConfig';

export interface UserConfig {
  homeCurrency: string;
  temperatureUnit: 'Celsius' | 'Fahrenheit';
  distanceUnit: 'Kilometres' | 'Miles';
  showTravellerNames: boolean;
  /** Stored display name for new journal entries; empty = use M365 display name at write time. */
  journalAuthorName: string;
  /** Persisted workspace sidebar width (px). */
  sidebarWidth: number;
  weatherApiKey: string;
}

export const DEFAULT_USER_CONFIG: UserConfig = {
  homeCurrency: 'NZD',
  temperatureUnit: 'Celsius',
  distanceUnit: 'Kilometres',
  showTravellerNames: true,
  journalAuthorName: '',
  sidebarWidth: 260,
  weatherApiKey: ''
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

  constructor(context: WebPartContext) {
    this.ctx = context;
    this.baseUrl = `${context.pageContext.web.absoluteUrl}/_api/web/lists/getbytitle('${LIST}')/items`;
  }

  private mapFromSpItem(item: Record<string, unknown>): UserConfig {
    return {
      homeCurrency: (item.HomeCurrency as string) || DEFAULT_USER_CONFIG.homeCurrency,
      temperatureUnit: item.TemperatureUnit === 'Fahrenheit' ? 'Fahrenheit' : 'Celsius',
      distanceUnit: item.DistanceUnit === 'Miles' ? 'Miles' : 'Kilometres',
      showTravellerNames:
        typeof item.ShowTravellerNames === 'boolean'
          ? item.ShowTravellerNames
          : DEFAULT_USER_CONFIG.showTravellerNames,
      journalAuthorName: typeof item.JournalAuthorName === 'string' ? item.JournalAuthorName : '',
      sidebarWidth:
        typeof item.SidebarWidth === 'number'
          ? item.SidebarWidth
          : Number(item.SidebarWidth ?? DEFAULT_USER_CONFIG.sidebarWidth) || DEFAULT_USER_CONFIG.sidebarWidth,
      weatherApiKey: typeof item.WeatherApiKey === 'string' ? item.WeatherApiKey : ''
    };
  }

  private mapToSpItem(userId: string, config: UserConfig): Record<string, unknown> {
    return {
      Title: userId,
      UserId: userId,
      HomeCurrency: config.homeCurrency,
      TemperatureUnit: config.temperatureUnit,
      DistanceUnit: config.distanceUnit,
      ShowTravellerNames: config.showTravellerNames,
      JournalAuthorName: config.journalAuthorName ?? '',
      SidebarWidth: typeof config.sidebarWidth === 'number' ? config.sidebarWidth : DEFAULT_USER_CONFIG.sidebarWidth,
      WeatherApiKey: config.weatherApiKey ?? ''
    };
  }

  private async getItemsWithFilter(filterExpr: string, includeUserIdField: boolean): Promise<SPHttpClientResponse> {
    const safeFilter = encodeURIComponent(filterExpr);
    const selectFields = includeUserIdField
      ? 'ID,Title,UserId,HomeCurrency,TemperatureUnit,DistanceUnit,ShowTravellerNames,JournalAuthorName,SidebarWidth,WeatherApiKey'
      : 'ID,Title,HomeCurrency,TemperatureUnit,DistanceUnit,ShowTravellerNames,JournalAuthorName,SidebarWidth,WeatherApiKey';
    const select = encodeURIComponent(selectFields);
    const url = `${this.baseUrl}?$select=${select}&$filter=${safeFilter}&$top=1`;
    return this.ctx.spHttpClient.get(url, SPHttpClient.configurations.v1);
  }

  private async getConfigItem(userId: string): Promise<{ id?: number; config: UserConfig; raw?: Record<string, unknown> }> {
    const safeUserId = userId.replace(/'/g, "''");
    let resp: SPHttpClientResponse;
    try {
      resp = await this.getItemsWithFilter(`UserId eq '${safeUserId}'`, true);
    } catch (err) {
      // eslint-disable-next-line no-console
      console.error('ConfigService.getConfigItem UserId query threw', err);
      return { config: { ...DEFAULT_USER_CONFIG } };
    }
    if (resp.status === 400 || resp.status === 406) {
      await logFailedResponse('getConfigItem UserId filter (will try Title fallback)', resp);
      try {
        resp = await this.getItemsWithFilter(`Title eq '${safeUserId}'`, false);
      } catch (err) {
        // eslint-disable-next-line no-console
        console.error('ConfigService.getConfigItem Title query threw', err);
        return { config: { ...DEFAULT_USER_CONFIG } };
      }
    }
    if (!resp.ok) {
      await logFailedResponse('getConfigItem', resp);
      return { config: { ...DEFAULT_USER_CONFIG } };
    }
    let data: { value?: Record<string, unknown>[] };
    try {
      data = await resp.json();
    } catch (err) {
      // eslint-disable-next-line no-console
      console.error('ConfigService.getConfigItem JSON parse', err);
      return { config: { ...DEFAULT_USER_CONFIG } };
    }
    const item = (data.value ?? [])[0];
    if (!item) {
      return { config: { ...DEFAULT_USER_CONFIG } };
    }
    const resolved = this.mapFromSpItem(item);
    return { id: Number(item.ID), config: resolved, raw: item };
  }

  async getConfig(userId: string): Promise<UserConfig> {
    const row = await this.getConfigItem(userId);
    return row.config;
  }

  async saveConfig(userId: string, config: UserConfig): Promise<void> {
    const existing = await this.getConfigItem(userId);
    const body = JSON.stringify(this.mapToSpItem(userId, config));

    if (existing.id) {
      const updateResp = await this.ctx.spHttpClient.fetch(`${this.baseUrl}(${existing.id})`, SPHttpClient.configurations.v1, {
        method: 'PATCH',
        headers: {
          Accept: 'application/json;odata.metadata=minimal',
          'Content-Type': 'application/json;odata.metadata=minimal',
          'IF-MATCH': '*'
        },
        body
      });
      if (!updateResp.ok && updateResp.status !== 204) {
        await logFailedResponse('saveConfig PATCH', updateResp);
        throw new Error(`ConfigService.saveConfig update failed: ${updateResp.status}`);
      }
      return;
    }

    const createResp = await this.ctx.spHttpClient.post(this.baseUrl, SPHttpClient.configurations.v1, {
      headers: {
        Accept: 'application/json;odata.metadata=minimal',
        'Content-Type': 'application/json;odata.metadata=minimal'
      },
      body
    });
    if (!createResp.ok && createResp.status !== 201) {
      await logFailedResponse('saveConfig POST', createResp);
      throw new Error(`ConfigService.saveConfig create failed: ${createResp.status}`);
    }
  }
}

