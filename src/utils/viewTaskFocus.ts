export const TRAVELHUB_VIEW_TASK = 'travelhub-view-task';

export interface ViewTaskDetail {
  reminderId: string;
  entryId?: string;
  dayId?: string;
}

export function requestViewTask(detail: ViewTaskDetail): void {
  window.dispatchEvent(new CustomEvent(TRAVELHUB_VIEW_TASK, { detail }));
}
