import { WebPartContext } from '@microsoft/sp-webpart-base';
import { SPHttpClient, SPHttpClientResponse } from '@microsoft/sp-http';

const LIST = 'AppConfig';

const JSON_ODATA_MINIMAL = 'application/json;odata=minimalmetadata';

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
          // AppConfig list is optional until provisioning runs.
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
}

