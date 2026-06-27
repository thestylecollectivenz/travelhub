import { WebPartContext } from '@microsoft/sp-webpart-base';

/** Primary user identity for Travel Hub (stable across storage backends). */
export function getCurrentUserEmail(ctx: WebPartContext): string {
  const direct = (ctx.pageContext.user.email ?? '').trim();
  if (direct) return direct.toLowerCase();
  const login = (ctx.pageContext.user.loginName ?? '').trim();
  const match = login.match(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/i);
  if (match) return match[0].toLowerCase();
  return login.toLowerCase();
}

export function getCurrentUserDisplayName(ctx: WebPartContext): string {
  return (ctx.pageContext.user.displayName ?? '').trim() || getCurrentUserEmail(ctx);
}
