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

export class ConfigService {
  private ctx: WebPartContext;
  private baseUrl: string;

  constructor(context: WebPartContext) {
    this.ctx = context;
    this.baseUrl = `${context.pageContext.web.absoluteUrl}/_api/web/lists/getbytitle('${LIST}')/items`;
  }

  private mapFromSpItem(item: any): UserConfig {
    return {
      homeCurrency: item.HomeCurrency || DEFAULT_USER_CONFIG.homeCurrency,
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

  private async getConfigItem(userId: string): Promise<{ id?: number; config: UserConfig; raw?: any }> {
    const safeUserId = userId.replace(/'/g, "''");
    const url = `${this.baseUrl}?$select=ID,UserId,HomeCurrency,TemperatureUnit,DistanceUnit,ShowTravellerNames,JournalAuthorName,SidebarWidth,WeatherApiKey&$filter=UserId eq '${safeUserId}'&$orderby=ID desc&$top=1`;
    // eslint-disable-next-line no-console
    console.log('ConfigService.getConfig query', { userId, url });
    const resp: SPHttpClientResponse = await this.ctx.spHttpClient.get(url, SPHttpClient.configurations.v1);
    if (!resp.ok) {
      throw new Error(`ConfigService.getConfig failed: ${resp.status}`);
    }
    const data = await resp.json();
    // eslint-disable-next-line no-console
    console.log('ConfigService.getConfig response', { userId, data });
    const item = (data.value ?? [])[0];
    if (!item) {
      // eslint-disable-next-line no-console
      console.log('ConfigService.getConfig item not found', { userId });
      return { config: { ...DEFAULT_USER_CONFIG } };
    }
    const resolved = this.mapFromSpItem(item);
    // eslint-disable-next-line no-console
    console.log('ConfigService.getConfig item found', { userId, id: item.ID, resolved });
    return { id: Number(item.ID), config: resolved, raw: item };
  }

  async getConfig(userId: string): Promise<UserConfig> {
    const row = await this.getConfigItem(userId);
    return row.config;
  }

  async saveConfig(userId: string, config: UserConfig): Promise<void> {
    const existing = await this.getConfigItem(userId);
    const body = JSON.stringify(this.mapToSpItem(userId, config));
    // eslint-disable-next-line no-console
    console.log('ConfigService.saveConfig write', { userId, existingId: existing.id, payload: JSON.parse(body) });

    if (existing.id) {
      const updateResp = await this.ctx.spHttpClient.fetch(`${this.baseUrl}(${existing.id})`, SPHttpClient.configurations.v1, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json;odata.metadata=minimal',
          Accept: 'application/json;odata.metadata=minimal',
          'IF-MATCH': '*',
          'X-HTTP-Method': 'MERGE'
        },
        body
      });
      if (!updateResp.ok) {
        throw new Error(`ConfigService.saveConfig update failed: ${updateResp.status}`);
      }
      // eslint-disable-next-line no-console
      console.log('ConfigService.saveConfig update ok', { userId, id: existing.id });
      return;
    }

    const createResp = await this.ctx.spHttpClient.post(
      this.baseUrl,
      SPHttpClient.configurations.v1,
      {
        headers: {
          'Content-Type': 'application/json;odata.metadata=minimal',
          Accept: 'application/json;odata.metadata=minimal'
        },
        body
      }
    );
    if (!createResp.ok && createResp.status !== 201) {
      throw new Error(`ConfigService.saveConfig create failed: ${createResp.status}`);
    }
    // eslint-disable-next-line no-console
    console.log('ConfigService.saveConfig create ok', { userId });
  }
}
