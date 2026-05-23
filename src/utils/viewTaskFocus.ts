export const TRAVELHUB_VIEW_TASK = 'travelhub-view-task';

export interface ViewTaskDetail {
  reminderId: string;
  entryId?: string;
  dayId?: string;
}

export function requestViewTask(detail: ViewTaskDetail): void {
  window.dispatchEvent(new CustomEvent(TRAVELHUB_VIEW_TASK, { detail }));
}

/** Scroll the tasks list to a reminder row; retries until the row is in the DOM. */
export function scrollToReminderRow(reminderId: string, maxAttempts = 12): void {
  const id = reminderId.trim();
  if (!id) return;

  const attempt = (n: number): void => {
    const el = document.querySelector(`[data-reminder-id="${id}"]`);
    if (el) {
      el.scrollIntoView({ behavior: n === 0 ? 'auto' : 'smooth', block: 'center' });
      return;
    }
    if (n < maxAttempts) {
      window.setTimeout(() => attempt(n + 1), 80 + n * 40);
    }
  };

  window.requestAnimationFrame(() => attempt(0));
}
