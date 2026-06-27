import { WebPartContext } from '@microsoft/sp-webpart-base';
import { SPHttpClient } from '@microsoft/sp-http';
import { getCurrentUserEmail } from '../utils/currentUserEmail';

const LIST = 'TripAccessLog';

export interface TripAccessLogEntry {
  id: string;
  tripId: string;
  userEmail: string;
  userDisplayName: string;
  action: string;
  resource: string;
  accessedAt: string;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function mapRow(item: any): TripAccessLogEntry {
  return {
    id: String(item.ID),
    tripId: item.TripId ?? '',
    userEmail: item.UserEmail ?? '',
    userDisplayName: item.UserDisplayName ?? '',
    action: item.Action ?? '',
    resource: item.Resource ?? '',
    accessedAt: item.AccessedAt ?? ''
  };
}

export class TripAccessLogService {
  private readonly baseUrl: string;

  constructor(private readonly ctx: WebPartContext) {
    this.baseUrl = `${ctx.pageContext.web.absoluteUrl}/_api/web/lists/getbytitle('${LIST}')/items`;
  }

  async getForTrip(tripId: string, top = 200): Promise<TripAccessLogEntry[]> {
    const safe = tripId.replace(/'/g, "''");
    const url = `${this.baseUrl}?$select=ID,TripId,UserEmail,UserDisplayName,Action,Resource,AccessedAt&$filter=TripId eq '${safe}'&$orderby=AccessedAt desc&$top=${top}`;
    const resp = await this.ctx.spHttpClient.get(url, SPHttpClient.configurations.v1);
    if (!resp.ok) return [];
    const data = await resp.json();
    return (data.value ?? []).map(mapRow);
  }

  async log(tripId: string, action: string, resource = ''): Promise<void> {
    if (!tripId || !action.trim()) return;
    const userEmail = getCurrentUserEmail(this.ctx);
    const userDisplayName = (this.ctx.pageContext.user.displayName || userEmail).trim();
    const now = new Date().toISOString();
    try {
      const resp = await this.ctx.spHttpClient.post(this.baseUrl, SPHttpClient.configurations.v1, {
        headers: {
          'Content-Type': 'application/json;odata.metadata=minimal',
          Accept: 'application/json;odata.metadata=minimal'
        },
        body: JSON.stringify({
          Title: action,
          TripId: tripId,
          UserEmail: userEmail,
          UserDisplayName: userDisplayName,
          Action: action,
          Resource: resource,
          AccessedAt: now
        })
      });
      if (!resp.ok) {
        // eslint-disable-next-line no-console
        console.warn('TripAccessLogService.log failed', resp.status);
      }
    } catch (err) {
      // eslint-disable-next-line no-console
      console.warn('TripAccessLogService.log error', err);
    }
  }
}

const recentKeys = new Set<string>();

/** Log once per session per trip+action+resource combination. */
export function logTripAccessOnce(ctx: WebPartContext, tripId: string, action: string, resource = ''): void {
  const key = `${tripId}|${action}|${resource}`;
  if (recentKeys.has(key)) return;
  recentKeys.add(key);
  const svc = new TripAccessLogService(ctx);
  void svc.log(tripId, action, resource);
}
