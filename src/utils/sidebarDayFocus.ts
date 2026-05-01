export const TRAVELHUB_SIDEBAR_FOCUS_DAY = 'travelhub:focus-day-in-sidebar';

export function requestSidebarDayFocus(dayId: string): void {
  if (!dayId) return;
  window.dispatchEvent(new CustomEvent(TRAVELHUB_SIDEBAR_FOCUS_DAY, { detail: { dayId } }));
}
