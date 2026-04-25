export type EntryDocumentType =
  | 'Ticket'
  | 'Confirmation'
  | 'Image'
  | 'PDF'
  | 'Other';

export interface EntryDocument {
  id: string;
  title: string;
  tripId: string;
  dayId: string;
  entryId: string;
  documentType: EntryDocumentType;
  fileUrl: string;
  fileName: string;
  notes: string;
}
