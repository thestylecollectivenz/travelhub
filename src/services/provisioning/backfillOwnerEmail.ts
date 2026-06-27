import { WebPartContext } from '@microsoft/sp-webpart-base';
import { SPHttpClient } from '@microsoft/sp-http';

const JSON_ODATA_MINIMAL = 'application/json;odata.metadata=minimal';

type ListConfig = { listTitle: string };

const LISTS: ListConfig[] = [
  { listTitle: 'JournalEntries' },
  { listTitle: 'PackingList' },
  { listTitle: 'ShoppingList' }
];

function authorEmail(item: Record<string, unknown>): string {
  const author = item.Author as { Email?: string; EMail?: string } | undefined;
  const email = (author?.Email ?? author?.EMail ?? '').trim();
  return email.toLowerCase();
}

async function backfillList(ctx: WebPartContext, listTitle: string): Promise<void> {
  const web = ctx.pageContext.web.absoluteUrl.replace(/\/$/, '');
  const safeList = listTitle.replace(/'/g, "''");
  const base = `${web}/_api/web/lists/getbytitle('${safeList}')/items`;
  const url = `${base}?$select=ID,OwnerEmail&$expand=Author&$filter=(OwnerEmail eq null) or (OwnerEmail eq '')&$top=200`;
  const resp = await ctx.spHttpClient.get(url, SPHttpClient.configurations.v1, {
    headers: { Accept: JSON_ODATA_MINIMAL }
  });
  if (!resp.ok) return;
  const data = (await resp.json()) as { value?: Record<string, unknown>[] };
  const rows = data.value ?? [];
  for (const row of rows) {
    const email = authorEmail(row);
    if (!email) continue;
    const id = row.ID;
    // eslint-disable-next-line no-await-in-loop
    await ctx.spHttpClient.fetch(`${base}(${id})`, SPHttpClient.configurations.v1, {
      method: 'PATCH',
      headers: {
        'Content-Type': JSON_ODATA_MINIMAL,
        Accept: JSON_ODATA_MINIMAL,
        'IF-MATCH': '*',
        'X-HTTP-Method': 'MERGE'
      },
      body: JSON.stringify({ OwnerEmail: email })
    });
  }
}

let backfillStarted = false;

/** One-time per session backfill of OwnerEmail from SharePoint Author where column exists. */
export function runOwnerEmailBackfill(ctx: WebPartContext): void {
  if (backfillStarted) return;
  backfillStarted = true;
  void (async () => {
    for (const { listTitle } of LISTS) {
      try {
        // eslint-disable-next-line no-await-in-loop
        await backfillList(ctx, listTitle);
      } catch (err) {
        // eslint-disable-next-line no-console
        console.warn(`OwnerEmail backfill skipped for ${listTitle}.`, err);
      }
    }
  })();
}
