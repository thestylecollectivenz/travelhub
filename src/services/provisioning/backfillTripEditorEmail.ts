import { WebPartContext } from '@microsoft/sp-webpart-base';
import { SPHttpClient } from '@microsoft/sp-http';
import { parseSharePointUserEmail } from '../../utils/currentUserEmail';
import { clearTripRoleCache } from '../../hooks/useCurrentUserRole';

const JSON_ODATA_MINIMAL = 'application/json;odata.metadata=minimal';

function authorEmail(item: Record<string, unknown>): string {
  const author = item.Author as { Email?: string; EMail?: string; LoginName?: string } | undefined;
  return parseSharePointUserEmail({
    email: author?.Email,
    eMail: author?.EMail,
    loginName: author?.LoginName
  });
}

/** Backfill Trips.EditorEmail from Author where column is empty. */
export async function backfillTripEditorEmail(ctx: WebPartContext): Promise<void> {
  const web = ctx.pageContext.web.absoluteUrl.replace(/\/$/, '');
  const base = `${web}/_api/web/lists/getbytitle('Trips')/items`;
  const url = `${base}?$select=ID,EditorEmail&$expand=Author($select=Email,EMail,LoginName)&$filter=(EditorEmail eq null) or (EditorEmail eq '')&$top=200`;
  const resp = await ctx.spHttpClient.get(url, SPHttpClient.configurations.v1, {
    headers: { Accept: JSON_ODATA_MINIMAL }
  });
  if (!resp.ok) return;
  const data = (await resp.json()) as { value?: Record<string, unknown>[] };
  let updated = 0;
  for (const row of data.value ?? []) {
    const email = authorEmail(row);
    if (!email) continue;
    const id = row.ID;
    // eslint-disable-next-line no-await-in-loop
    const patch = await ctx.spHttpClient.fetch(`${base}(${id})`, SPHttpClient.configurations.v1, {
      method: 'PATCH',
      headers: {
        'Content-Type': JSON_ODATA_MINIMAL,
        Accept: JSON_ODATA_MINIMAL,
        'IF-MATCH': '*',
        'X-HTTP-Method': 'MERGE'
      },
      body: JSON.stringify({ EditorEmail: email })
    });
    if (patch.ok) {
      updated += 1;
      clearTripRoleCache(String(id));
    }
  }
  if (updated > 0 && typeof window !== 'undefined') {
    window.dispatchEvent(new Event('travelhub-trip-role-refresh'));
  }
}

let backfillStarted = false;

export function runTripEditorEmailBackfill(ctx: WebPartContext): void {
  if (backfillStarted) return;
  backfillStarted = true;
  void backfillTripEditorEmail(ctx).catch((err) => {
    // eslint-disable-next-line no-console
    console.warn('Trip EditorEmail backfill skipped.', err);
  });
}
