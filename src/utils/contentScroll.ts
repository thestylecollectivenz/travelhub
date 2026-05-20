export const TRAVELHUB_SCROLL_JOURNAL_DAY = 'travelhub-scroll-journal-day';
export const TRAVELHUB_SCROLL_PHOTOS_DAY = 'travelhub-scroll-photos-day';

export function requestJournalDayScroll(dayId: string): void {
  window.dispatchEvent(new CustomEvent(TRAVELHUB_SCROLL_JOURNAL_DAY, { detail: { dayId } }));
}

export function requestPhotosDayScroll(dayId: string): void {
  window.dispatchEvent(new CustomEvent(TRAVELHUB_SCROLL_PHOTOS_DAY, { detail: { dayId } }));
}
