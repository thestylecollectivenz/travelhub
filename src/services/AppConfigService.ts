import { WebPartContext } from '@microsoft/sp-webpart-base';
import { SPHttpClient, SPHttpClientResponse } from '@microsoft/sp-http';

const LIST = 'AppConfig';

const JSON_ODATA_MINIMAL = 'application/json;odata=minimalmetadata';
const JSON_ODATA_VERBOSE = 'application/json;odata=verbose';

async function logFailedResponse(label: string, resp: SPHttpClientResponse): Promise<void> {
  let body = '';
  try {
    body = await resp.text();
  } catch {
    body = '(could not read body)';
  }
  // eslint-disable-next-line no-console
  console.error(`AppConfigService ${label}`, { status: resp.status, body });
}

export class AppConfigService {
  private ctx: WebPartContext;
  private baseUrl: string;

  constructor(context: WebPartContext) {
    this.ctx = context;
    this.baseUrl = `${context.pageContext.web.absoluteUrl}/_api/web/lists/getbytitle('${LIST}')/items`;
  }

  /** Load all AppConfig rows (ConfigKey → ConfigValue). Returns empty map if list missing or request fails. */
  async getAll(): Promise<Map<string, string>> {
    const out = new Map<string, string>();
    const select = encodeURIComponent('ID,ConfigKey,ConfigValue');
    const url = `${this.baseUrl}?$select=${select}&$top=5000`;
    try {
      const resp = await this.ctx.spHttpClient.get(url, SPHttpClient.configurations.v1, {
        headers: { Accept: JSON_ODATA_MINIMAL }
      });
      if (!resp.ok) {
        if (resp.status === 404) {
          return out;
        }
        await logFailedResponse('getAll', resp);
        return out;
      }
      const data = (await resp.json()) as { value?: Array<{ ConfigKey?: string; ConfigValue?: string; ID?: number }> };
      for (const row of data.value ?? []) {
        const k = (row.ConfigKey ?? '').trim();
        if (k) out.set(k, row.ConfigValue ?? '');
      }
    } catch (err) {
      // eslint-disable-next-line no-console
      console.error('AppConfigService.getAll', err);
    }
    return out;
  }

  async getValue(key: string): Promise<string | undefined> {
    const k = key.trim();
    if (!k) return undefined;
    const all = await this.getAll();
    const v = all.get(k);
    return v !== undefined && v !== '' ? v : undefined;
  }

  /** Upsert a config key. Requires permission to edit the AppConfig list. */
  async setValue(key: string, value: string): Promise<void> {
    const configKey = key.trim();
    if (!configKey) throw new Error('Config key is required');

    const select = encodeURIComponent('ID,ConfigKey,ConfigValue');
    const filter = encodeURIComponent(`ConfigKey eq '${configKey.replace(/'/g, "''")}'`);
    const findUrl = `${this.baseUrl}?$select=${select}&$filter=${filter}&$top=1`;
    const findResp = await this.ctx.spHttpClient.get(findUrl, SPHttpClient.configurations.v1, {
      headers: { Accept: JSON_ODATA_MINIMAL }
    });
    if (!findResp.ok) {
      await logFailedResponse('setValue.find', findResp);
      throw new Error(`Could not read AppConfig (${findResp.status})`);
    }
    const found = (await findResp.json()) as { value?: Array<{ ID?: number }> };
    const rowId = found.value?.[0]?.ID;

    if (rowId) {
      const url = `${this.baseUrl}(${rowId})`;
      const resp = await this.ctx.spHttpClient.post(url, SPHttpClient.configurations.v1, {
        headers: {
          Accept: JSON_ODATA_VERBOSE,
          'Content-Type': JSON_ODATA_VERBOSE,
          'IF-MATCH': '*',
          'X-HTTP-Method': 'MERGE'
        },
        body: JSON.stringify({
          __metadata: { type: 'SP.Data.AppConfigListItem' },
          ConfigValue: value
        })
      });
      if (!resp.ok) {
        await logFailedResponse('setValue.update', resp);
        throw new Error(`Could not update AppConfig (${resp.status})`);
      }
      return;
    }

    const resp = await this.ctx.spHttpClient.post(this.baseUrl, SPHttpClient.configurations.v1, {
      headers: {
        Accept: JSON_ODATA_VERBOSE,
        'Content-Type': JSON_ODATA_VERBOSE
      },
      body: JSON.stringify({
        __metadata: { type: 'SP.Data.AppConfigListItem' },
        Title: configKey,
        ConfigKey: configKey,
        ConfigValue: value
      })
    });
    if (!resp.ok) {
      await logFailedResponse('setValue.create', resp);
      throw new Error(`Could not create AppConfig row (${resp.status})`);
    }
  }
}
