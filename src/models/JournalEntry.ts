export interface JournalEntry {
  id: string;
  title: string;
  tripId: string;
  dayId: string;
  authorName: string;
  entryText: string;
  location: string;
  entryTimestamp: string;
  likeCount: number;
  likedByUsers: string;
  shareableLink: string;
}
