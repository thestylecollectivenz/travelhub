export interface JournalComment {
  id: string;
  title: string;
  journalEntryId: string;
  tripId: string;
  authorName: string;
  commentText: string;
  commentTimestamp: string;
}
