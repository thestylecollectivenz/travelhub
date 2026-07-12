export const EXPAND_UNSCHEDULED_EVENT = 'travelhub-expand-unscheduled';

export function notifyExpandUnscheduled(): void {
  window.dispatchEvent(new Event(EXPAND_UNSCHEDULED_EVENT));
}
