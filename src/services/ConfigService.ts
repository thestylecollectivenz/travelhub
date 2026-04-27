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

  async getConfig(userId: string): Promise<UserConfig> {
    const safeUserId = userId.replace(/'/g, "''");
    const url = `${this.baseUrl}?$select=ID,UserId,HomeCurrency,TemperatureUnit,DistanceUnit,ShowTravellerNames,JournalAuthorName,SidebarWidth,WeatherApiKey&$filter=UserId eq '${safeUserId}'&$orderby=ID desc&$top=1`;
    const resp: SPHttpClientResponse = await this.ctx.spHttpClient.get(url, SPHttpClient.configurations.v1);
    if (!resp.ok) {
      throw new Error(`ConfigService.getConfig failed: ${resp.status}`);
    }
    const data = await resp.json();
    const item = (data.value ?? [])[0];
    if (!item) {
      return { ...DEFAULT_USER_CONFIG };
    }
    const resolved: UserConfig = {
      homeCurrency: item.HomeCurrency || DEFAULT_USER_CONFIG.homeCurrency,
      temperatureUnit: item.TemperatureUnit === 'Fahrenheit' ? 'Fahrenheit' : 'Celsius',
      distanceUnit: item.DistanceUnit === 'Miles' ? 'Miles' : 'Kilometres',
      showTravellerNames:
        typeof item.ShowTravellerNames === 'boolean'
          ? item.ShowTravellerNames
          : DEFAULT_USER_CONFIG.showTravellerNames,
      journalAuthorName: typeof item.JournalAuthorName === 'string' ? item.JournalAuthorName : '',
      sidebarWidth: typeof item.SidebarWidth === 'number' ? item.SidebarWidth : Number(item.SidebarWidth ?? DEFAULT_USER_CONFIG.sidebarWidth) || DEFAULT_USER_CONFIG.sidebarWidth,
      weatherApiKey: typeof item.WeatherApiKey === 'string' ? item.WeatherApiKey : ''
    };
    // eslint-disable-next-line no-console
    console.log('ConfigService.getConfig read', resolved);
    return resolved;
  }

  async saveConfig(userId: string, config: UserConfig): Promise<void> {
    const safeUserId = userId.replace(/'/g, "''");
    const findUrl = `${this.baseUrl}?$select=ID&$filter=UserId eq '${safeUserId}'&$orderby=ID desc&$top=1`;
    const findResp: SPHttpClientResponse = await this.ctx.spHttpClient.get(findUrl, SPHttpClient.configurations.v1);
    if (!findResp.ok) {
      throw new Error(`ConfigService.saveConfig find failed: ${findResp.status}`);
    }
    const findData = await findResp.json();
    const existing = (findData.value ?? [])[0] as { ID: number } | undefined;

    const body = JSON.stringify({
      Title: userId,
      UserId: userId,
      HomeCurrency: config.homeCurrency,
      TemperatureUnit: config.temperatureUnit,
      DistanceUnit: config.distanceUnit,
      ShowTravellerNames: config.showTravellerNames,
      JournalAuthorName: config.journalAuthorName ?? '',
      SidebarWidth: typeof config.sidebarWidth === 'number' ? config.sidebarWidth : DEFAULT_USER_CONFIG.sidebarWidth,
      WeatherApiKey: config.weatherApiKey ?? ''
    });
    // eslint-disable-next-line no-console
    console.log('ConfigService.saveConfig write', config);

    if (existing?.ID) {
      const updateResp = await this.ctx.spHttpClient.post(
        `${this.baseUrl}(${existing.ID})`,
        SPHttpClient.configurations.v1,
        {
          headers: {
            'Content-Type': 'application/json;odata.metadata=minimal',
            Accept: 'application/json;odata.metadata=minimal',
            'IF-MATCH': '*',
            'X-HTTP-Method': 'MERGE'
          },
          body
        }
      );
      if (!updateResp.ok) {
        throw new Error(`ConfigService.saveConfig update failed: ${updateResp.status}`);
      }
      // eslint-disable-next-line no-console
      console.log('ConfigService.saveConfig update ok');
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
    console.log('ConfigService.saveConfig create ok');
  }
}
