import { WebPartContext } from '@microsoft/sp-webpart-base';
import { SPHttpClient, SPHttpClientResponse } from '@microsoft/sp-http';
import type { TripMember, TripRoleLevel } from '../models/TripMember';
import { parseTripRoleLevel } from '../models/TripMember';
import { getCurrentUserDisplayName, getCurrentUserEmail } from '../utils/currentUserEmail';

const LIST = 'TripMembers';

function mapRow(item: Record<string, unknown>): TripMember | null {
  const role = parseTripRoleLevel(String(item.Role ?? ''));
  if (!role) return null;
  return {
    id: String(item.ID),
    tripId: String(item.TripId ?? ''),
    userId: String(item.UserId ?? ''),
    userEmail: String(item.UserEmail ?? '').trim().toLowerCase(),
    userDisplayName: String(item.UserDisplayName ?? ''),
    role,
    invitedBy: String(item.InvitedBy ?? ''),
    invitedAt: typeof item.InvitedAt === 'string' ? item.InvitedAt : ''
  };
}

function toSpBody(partial: Partial<TripMember>): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  if (partial.tripId !== undefined) out.TripId = partial.tripId;
  if (partial.userId !== undefined) out.UserId = partial.userId;
  if (partial.userEmail !== undefined) out.UserEmail = partial.userEmail;
  if (partial.userDisplayName !== undefined) out.UserDisplayName = partial.userDisplayName;
  if (partial.role !== undefined) out.Role = partial.role;
  if (partial.invitedBy !== undefined) out.InvitedBy = partial.invitedBy;
  if (partial.invitedAt !== undefined) out.InvitedAt = partial.invitedAt;
  if (partial.userDisplayName !== undefined) out.Title = partial.userDisplayName;
  return out;
}

export class TripMembersService {
  private readonly baseUrl: string;
  private readonly tripsUrl: string;

  constructor(private readonly ctx: WebPartContext) {
    const web = ctx.pageContext.web.absoluteUrl.replace(/\/$/, '');
    this.baseUrl = `${web}/_api/web/lists/getbytitle('${LIST}')/items`;
    this.tripsUrl = `${web}/_api/web/lists/getbytitle('Trips')/items`;
  }

  async getForTrip(tripId: string): Promise<TripMember[]> {
    const safe = tripId.replace(/'/g, "''");
    const url = `${this.baseUrl}?$select=ID,TripId,UserId,UserEmail,UserDisplayName,Role,InvitedBy,InvitedAt&$filter=TripId eq '${safe}'&$orderby=UserDisplayName asc&$top=500`;
    const resp = await this.ctx.spHttpClient.get(url, SPHttpClient.configurations.v1);
    if (resp.status === 404) return [];
    if (!resp.ok) throw new Error(`TripMembersService.getForTrip failed: ${resp.status}`);
    const data = await resp.json();
    return (data.value ?? [])
      .map((row: Record<string, unknown>) => mapRow(row))
      .filter((m: TripMember | null): m is TripMember => m !== null);
  }

  async getTripAuthorEmail(tripId: string): Promise<string | null> {
    const url = `${this.tripsUrl}(${tripId})?$select=ID&$expand=Author`;
    const resp = await this.ctx.spHttpClient.get(url, SPHttpClient.configurations.v1);
    if (!resp.ok) return null;
    const data = (await resp.json()) as { Author?: { Email?: string; EMail?: string } };
    const email = (data.Author?.Email ?? data.Author?.EMail ?? '').trim();
    return email ? email.toLowerCase() : null;
  }

  async addMember(input: {
    tripId: string;
    userEmail: string;
    userDisplayName: string;
    role: TripRoleLevel;
    userId?: string;
  }): Promise<TripMember> {
    const email = input.userEmail.trim().toLowerCase();
    const body = toSpBody({
      tripId: input.tripId,
      userId: input.userId ?? '',
      userEmail: email,
      userDisplayName: input.userDisplayName.trim() || email,
      role: input.role,
      invitedBy: getCurrentUserEmail(this.ctx),
      invitedAt: new Date().toISOString()
    });
    body.Title = input.userDisplayName.trim() || email;
    const resp = await this.ctx.spHttpClient.post(this.baseUrl, SPHttpClient.configurations.v1, {
      headers: { 'Content-Type': 'application/json;odata.metadata=minimal', Accept: 'application/json;odata.metadata=minimal' },
      body: JSON.stringify(body)
    });
    if (!resp.ok) throw new Error(`TripMembersService.addMember failed: ${resp.status}`);
    const created = mapRow(await resp.json());
    if (!created) throw new Error('TripMembersService.addMember returned invalid role');
    return created;
  }

  async updateRole(id: string, role: TripRoleLevel): Promise<void> {
    const resp: SPHttpClientResponse = await this.ctx.spHttpClient.fetch(`${this.baseUrl}(${id})`, SPHttpClient.configurations.v1, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json;odata.metadata=minimal',
        Accept: 'application/json;odata.metadata=minimal',
        'IF-MATCH': '*',
        'X-HTTP-Method': 'MERGE'
      },
      body: JSON.stringify({ Role: role })
    });
    if (!resp.ok && resp.status !== 204) throw new Error(`TripMembersService.updateRole failed: ${resp.status}`);
  }

  async removeMember(id: string): Promise<void> {
    const resp = await this.ctx.spHttpClient.fetch(`${this.baseUrl}(${id})`, SPHttpClient.configurations.v1, {
      method: 'DELETE',
      headers: { 'IF-MATCH': '*', 'X-HTTP-Method': 'DELETE' }
    });
    if (!resp.ok && resp.status !== 204) throw new Error(`TripMembersService.removeMember failed: ${resp.status}`);
  }

  currentUserSnapshot(): { email: string; displayName: string; userId: string } {
    return {
      email: getCurrentUserEmail(this.ctx),
      displayName: getCurrentUserDisplayName(this.ctx),
      userId: String(this.ctx.pageContext.legacyPageContext?.userId ?? this.ctx.pageContext.user.loginName ?? '')
    };
  }
}
