export type EntryLinkType = 'Url' | 'Supplier' | 'Email' | 'Other';

export interface EntryLink {
  id: string;
  entryId: string;
  tripId: string;
  title: string;
  url: string;
  linkType: EntryLinkType;
  dayId: string;
  category: string;
}
