export type EntryLinkType = 'Url' | 'Supplier' | 'Booking' | 'Email' | 'Other';

export interface EntryLink {
  id: string;
  title: string;
  tripId: string;
  dayId: string;
  entryId: string;
  linkType: EntryLinkType;
  url: string;
  linkTitle: string;
  notes: string;
}
