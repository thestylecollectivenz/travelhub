import type { WebPartContext } from '@microsoft/sp-webpart-base';
import { SPHttpClient } from '@microsoft/sp-http';
import type { TripRoleLevel } from '../models/TripMember';

export type SiteInviteOutcome =
  | { ok: true; groupTitle: string; alreadyHadAccess?: boolean }
  | { ok: false; message: string };

interface SpGroupInfo {
  id: number;
  title: string;
}

/**
 * Invites a person to this SharePoint site (guest or internal) via the same
 * ShareObject API the Share button uses, then they can open Travel Hub.
 *
 * Followers → Site Visitors (Read)
 * Companion / Editor → Site Members (Edit)
 *
 * Requires the signed-in user to be allowed to share the site / invite guests
 * (tenant sharing settings + their own site permissions).
 */
export class SiteGuestInviteService {
  private readonly webUrl: string;

  constructor(private readonly ctx: WebPartContext) {
    this.webUrl = ctx.pageContext.web.absoluteUrl.replace(/\/$/, '');
  }

  async inviteEmailToSite(email: string, role: TripRoleLevel): Promise<SiteInviteOutcome> {
    const trimmed = (email || '').trim().toLowerCase();
    if (!trimmed || trimmed.indexOf('@') < 0) {
      return { ok: false, message: 'Enter a valid email address.' };
    }

    let group: SpGroupInfo;
    try {
      group = await this.resolveTargetGroup(role);
    } catch (err) {
      return {
        ok: false,
        message: err instanceof Error ? err.message : 'Could not resolve the site Visitors/Members group.'
      };
    }

    try {
      const result = await this.shareObject(trimmed, group.id);
      if (!result.ok) return result;
      return { ok: true, groupTitle: group.title, alreadyHadAccess: result.alreadyHadAccess };
    } catch (err) {
      return {
        ok: false,
        message:
          err instanceof Error
            ? err.message
            : 'Could not invite this person to the SharePoint site. Check sharing settings and try again.'
      };
    }
  }

  private async resolveTargetGroup(role: TripRoleLevel): Promise<SpGroupInfo> {
    // Followers only need read access; Companions/Editors need list edit rights.
    const endpoint =
      role === 'Follower'
        ? `${this.webUrl}/_api/web/associatedvisitorgroup?$select=Id,Title`
        : `${this.webUrl}/_api/web/associatedmembergroup?$select=Id,Title`;
    const resp = await this.ctx.spHttpClient.get(endpoint, SPHttpClient.configurations.v1, {
      headers: { Accept: 'application/json;odata.metadata=minimal' }
    });
    if (!resp.ok) {
      throw new Error(
        role === 'Follower'
          ? 'Could not find the site Visitors group.'
          : 'Could not find the site Members group.'
      );
    }
    const data = (await resp.json()) as { Id?: number; Title?: string };
    const id = Number(data.Id);
    if (!Number.isFinite(id) || id <= 0) {
      throw new Error('Site group id was missing.');
    }
    return { id, title: String(data.Title || (role === 'Follower' ? 'Visitors' : 'Members')) };
  }

  private async shareObject(
    email: string,
    groupId: number
  ): Promise<{ ok: true; alreadyHadAccess?: boolean } | { ok: false; message: string }> {
    const peoplePickerInput = JSON.stringify([
      {
        Key: email,
        DisplayText: email,
        IsResolved: false,
        EntityType: '',
        EntityData: { Email: email },
        MultipleMatches: [],
        ProviderName: '',
        ProviderDisplayName: ''
      }
    ]);

    const inviterName =
      (this.ctx.pageContext.user.displayName || '').trim() ||
      (this.ctx.pageContext.user.email || '').trim() ||
      'a Travel Hub editor';

    const body = {
      url: this.webUrl,
      peoplePickerInput,
      roleValue: `group:${groupId}`,
      sendEmail: true,
      includeAnonymousLinkInEmail: false,
      emailSubject: 'You are invited to a Travel Hub trip site',
      emailBody:
        `${inviterName} invited you to open Travel Hub on their SharePoint site.\n\n` +
        `Sign in with this Microsoft account (${email}), then open the Travel Hub page on the site.\n` +
        `Guest Microsoft accounts (Outlook, Hotmail, Gmail linked to Microsoft, etc.) usually do not need a paid SharePoint licence.`,
      useSimplifiedRoles: true,
      propagateAcl: false,
      groupId: 0
    };

    const resp = await this.ctx.spHttpClient.post(
      `${this.webUrl}/_api/SP.Web.ShareObject`,
      SPHttpClient.configurations.v1,
      {
        headers: {
          Accept: 'application/json;odata.metadata=minimal',
          'Content-Type': 'application/json;odata.metadata=minimal',
          'odata-version': ''
        },
        body: JSON.stringify(body)
      }
    );

    const text = await resp.text();
    let parsed: Record<string, unknown> = {};
    try {
      parsed = text ? (JSON.parse(text) as Record<string, unknown>) : {};
    } catch {
      parsed = {};
    }

    if (!resp.ok) {
      const detail =
        String(parsed.error_description || parsed.message || parsed.error || '').trim() ||
        text.slice(0, 280) ||
        `HTTP ${resp.status}`;
      return {
        ok: false,
        message: this.friendlyShareError(detail)
      };
    }

    // ShareObject often returns 200 with StatusCode / ErrorMessage even on logical failure.
    const statusCode = Number(parsed.StatusCode ?? parsed.statusCode ?? 0);
    const errorMessage = String(parsed.ErrorMessage ?? parsed.errorMessage ?? '').trim();
    if (statusCode !== 0 && errorMessage) {
      return { ok: false, message: this.friendlyShareError(errorMessage) };
    }
    if (errorMessage && /couldn.?t resolve|could not resolve|external user|sharing/i.test(errorMessage)) {
      return { ok: false, message: this.friendlyShareError(errorMessage) };
    }

    const usersAdded = parsed.UsersAddedToGroup ?? parsed.usersAddedToGroup;
    const already =
      Array.isArray(usersAdded) && usersAdded.length === 0
        ? true
        : undefined;

    return { ok: true, alreadyHadAccess: already };
  }

  private friendlyShareError(raw: string): string {
    const msg = raw.replace(/\s+/g, ' ').trim();
    if (/guest|external|sharing.*(disabled|not allowed|blocked)/i.test(msg)) {
      return (
        'SharePoint blocked the guest invite. In the Microsoft 365 admin / SharePoint sharing settings, ' +
        'allow guests (or “Anyone” / “New and existing guests”), then try again.'
      );
    }
    if (/access denied|403|permission/i.test(msg)) {
      return (
        'You do not have permission to share this site. Ask a site owner to share it, or invite the guest from SharePoint site settings.'
      );
    }
    if (/couldn.?t resolve|could not resolve/i.test(msg)) {
      return (
        'SharePoint could not resolve that email. Use a Microsoft account address (Outlook, Hotmail, or Gmail linked to Microsoft).'
      );
    }
    return msg || 'SharePoint site invite failed.';
  }
}
