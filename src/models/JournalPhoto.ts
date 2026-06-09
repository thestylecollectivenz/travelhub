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
}
