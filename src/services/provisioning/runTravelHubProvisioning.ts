import { WebPartContext } from '@microsoft/sp-webpart-base';
import { ensureTripMembersList } from './ensureTripMembersList';

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
      await ensureTripMembersList(ctx);
    } catch (err) {
      // Non-fatal: user may lack list-manage permissions; admin can run scripts/provision-lists.ps1.
      // eslint-disable-next-line no-console
      console.warn('Travel Hub provisioning: TripMembers ensure failed.', err);
    }
  })();
}
