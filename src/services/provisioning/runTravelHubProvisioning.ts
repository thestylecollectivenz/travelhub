import { WebPartContext } from '@microsoft/sp-webpart-base';
import { ensureTripMembersList } from './ensureTripMembersList';
import { ensureOwnerEmailColumns } from './ensureOwnerEmailColumns';
import { ensureTripAccessLogList } from './ensureTripAccessLogList';
import { ensureEditorEmailOnTrips } from './ensureEditorEmailOnTrips';
import { ensureUserConfigColumns } from './ensureUserConfigColumns';
import { runOwnerEmailBackfill } from './backfillOwnerEmail';
import { runTripEditorEmailBackfill } from './backfillTripEditorEmail';

let provisioningStarted = false;

/**
 * First-run / session provisioning sequence. Append-only — creates missing lists and columns only.
 * Safe to call on every app load; runs at most once per page session.
 */
export function runTravelHubProvisioning(ctx: WebPartContext): void {
  if (provisioningStarted) return;
  provisioningStarted = true;

  void (async () => {
    try {
      await ensureUserConfigColumns(ctx);
      await ensureTripMembersList(ctx);
      await ensureOwnerEmailColumns(ctx);
      await ensureTripAccessLogList(ctx);
      await ensureEditorEmailOnTrips(ctx);
      runOwnerEmailBackfill(ctx);
      runTripEditorEmailBackfill(ctx);
    } catch (err) {
      // Non-fatal: user may lack list-manage permissions; admin can run scripts/provision-lists.ps1.
      // eslint-disable-next-line no-console
      console.warn('Travel Hub provisioning failed.', err);
    }
  })();
}
