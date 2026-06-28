import { WebPartContext } from '@microsoft/sp-webpart-base';

/** Extract a normalised email from SharePoint user fields (Email, EMail, LoginName). */
export function parseSharePointUserEmail(fields: {
  email?: string;
  eMail?: string;
  loginName?: string;
}): string {
  const direct = (fields.email ?? fields.eMail ?? '').trim();
  if (direct) return direct.toLowerCase();
  const login = (fields.loginName ?? '').trim();
  const match = login.match(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/i);
  if (match) return match[0].toLowerCase();
  return '';
}

/** Primary user identity for Travel Hub (stable across storage backends). */
export function getCurrentUserEmail(ctx: WebPartContext): string {
  const direct = parseSharePointUserEmail({
    email: ctx.pageContext.user.email,
    loginName: ctx.pageContext.user.loginName
  });
  if (direct) return direct;
  return (ctx.pageContext.user.loginName ?? '').trim().toLowerCase();
}

export function getCurrentUserId(ctx: WebPartContext): number | undefined {
  const raw = ctx.pageContext.legacyPageContext?.userId;
  if (raw === undefined || raw === null || raw === '') return undefined;
  const n = Number(raw);
  return Number.isFinite(n) ? n : undefined;
}

export function getCurrentUserDisplayName(ctx: WebPartContext): string {
  return (ctx.pageContext.user.displayName ?? '').trim() || getCurrentUserEmail(ctx);
}
