export interface JournalPhoto {
  id: string;
  title: string;
  journalEntryId: string;
  tripId: string;
  dayId: string;
  fileUrl: string;
  caption: string;
  likeCount: number;
  likedByUsers: string;
  /** Display order within a journal entry (lower = earlier). */
  sortOrder: number;
  /** Square-crop focal point (0–100). Default centre when 50. */
  focalX: number;
  focalY: number;
}
