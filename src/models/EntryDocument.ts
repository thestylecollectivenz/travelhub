export type EntryDocumentType =
  | 'Ticket'
  | 'Confirmation'
  | 'Image'
  | 'Pdf'
  | 'Other';

export interface EntryDocument {
  id: string;
  entryId: string;
  tripId: string;
  title: string;
  fileUrl: string;
  documentType: EntryDocumentType;
  dayId: string;
  category: string;
}
