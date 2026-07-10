import { WebPartContext } from '@microsoft/sp-webpart-base';
import { SPHttpClient, SPHttpClientResponse } from '@microsoft/sp-http';
import type { TripMember, TripRoleLevel } from '../models/TripMember';
import { parseTripRoleLevel } from '../models/TripMember';
import { getCurrentUserDisplayName, getCurrentUserEmail, getCurrentUserId, parseSharePointUserEmail } from '../utils/currentUserEmail';

export interface TripAuthorIdentity {
  authorId?: number;
  email: string;
  editorEmail?: string;
  loginName?: string;
}


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
    avatarUrl: typeof item.AvatarUrl === 'string' ? item.AvatarUrl.trim() : '',
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
  if (partial.avatarUrl !== undefined) out.AvatarUrl = partial.avatarUrl;
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

  private async fetchMembers(url: string): Promise<TripMember[]> {
    const resp = await this.ctx.spHttpClient.get(url, SPHttpClient.configurations.v1);
    if (resp.status === 404) return [];
    if (!resp.ok) throw new Error(`TripMembersService.getForTrip failed: ${resp.status}`);
    const data = await resp.json();
    return (data.value ?? [])
      .map((row: Record<string, unknown>) => mapRow(row))
      .filter((m: TripMember | null): m is TripMember => m !== null);
  }

  async getForTrip(tripId: string): Promise<TripMember[]> {
    const safe = tripId.replace(/'/g, "''");
    const numeric = /^\d+$/.test(tripId.trim()) ? tripId.trim() : '';
    const selectFull =
      'ID,TripId,UserId,UserEmail,UserDisplayName,AvatarUrl,Role,InvitedBy,InvitedAt';
    const selectBase = 'ID,TripId,UserId,UserEmail,UserDisplayName,Role,InvitedBy,InvitedAt';
    const filters = [`TripId eq '${safe}'`];
    if (numeric) filters.push(`TripId eq ${numeric}`);

    for (const filter of filters) {
      for (const select of [selectFull, selectBase]) {
        try {
          const url = `${this.baseUrl}?$select=${select}&$filter=${filter}&$orderby=UserDisplayName asc&$top=500`;
          const rows = await this.fetchMembers(url);
          if (rows.length || select === selectBase) return rows;
        } catch {
          // try next query shape
        }
      }
    }

    // Last resort: load recent rows and filter client-side (handles odd TripId storage).
    try {
      const url = `${this.baseUrl}?$select=${selectBase}&$orderby=ID desc&$top=500`;
      const rows = await this.fetchMembers(url);
      const want = tripId.trim();
      return rows.filter((m) => m.tripId === want || m.tripId === numeric);
    } catch (err) {
      throw err instanceof Error ? err : new Error('TripMembersService.getForTrip failed');
    }
  }

  async getTripAuthorIdentity(tripId: string): Promise<TripAuthorIdentity> {
    const url = `${this.tripsUrl}(${tripId})?$select=AuthorId,EditorEmail&$expand=Author($select=Id,Email,EMail,LoginName)`;
    const resp = await this.ctx.spHttpClient.get(url, SPHttpClient.configurations.v1);
    if (!resp.ok) return { email: '' };
    const data = (await resp.json()) as {
      AuthorId?: number;
      EditorEmail?: string;
      Author?: { Id?: number; Email?: string; EMail?: string; LoginName?: string };
    };
    const author = data.Author;
    const fromAuthor = parseSharePointUserEmail({
      email: author?.Email,
      eMail: author?.EMail,
      loginName: author?.LoginName
    });
    const editorEmail = String(data.EditorEmail ?? '').trim().toLowerCase();
    const authorId = author?.Id ?? data.AuthorId;
    return {
      authorId: authorId !== undefined && authorId !== null ? Number(authorId) : undefined,
      email: editorEmail || fromAuthor,
      editorEmail: editorEmail || undefined,
      loginName: (author?.LoginName ?? '').trim() || undefined
    };
  }

  /** @deprecated Use getTripAuthorIdentity */
  async getTripAuthorEmail(tripId: string): Promise<string | null> {
    const identity = await this.getTripAuthorIdentity(tripId);
    return identity.email || null;
  }

  isCurrentUserTripAuthor(author: TripAuthorIdentity): boolean {
    const meId = getCurrentUserId(this.ctx);
    if (author.authorId !== undefined && meId !== undefined && Number(author.authorId) === Number(meId)) {
      return true;
    }
    const meEmail = getCurrentUserEmail(this.ctx);
    if (author.editorEmail && author.editorEmail === meEmail) return true;
    if (author.email && author.email === meEmail) return true;
    const myLogin = (this.ctx.pageContext.user.loginName ?? '').trim().toLowerCase();
    const authLogin = (author.loginName ?? '').trim().toLowerCase();
    if (myLogin && authLogin) {
      if (myLogin === authLogin) return true;
      const myTail = myLogin.split('|').pop() || myLogin;
      const authTail = authLogin.split('|').pop() || authLogin;
      if (myTail === authTail) return true;
    }
    return false;
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

  async updateAvatarUrl(id: string, avatarUrl: string): Promise<void> {
    const resp: SPHttpClientResponse = await this.ctx.spHttpClient.fetch(`${this.baseUrl}(${id})`, SPHttpClient.configurations.v1, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json;odata.metadata=minimal',
        Accept: 'application/json;odata.metadata=minimal',
        'IF-MATCH': '*',
        'X-HTTP-Method': 'MERGE'
      },
      body: JSON.stringify({ AvatarUrl: (avatarUrl || '').trim() })
    });
    if (!resp.ok && resp.status !== 204) throw new Error(`TripMembersService.updateAvatarUrl failed: ${resp.status}`);
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
