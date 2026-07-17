export type TripLifecycleStatus =
  | 'Planning'
  | 'Upcoming'
  | 'In Progress'
  | 'Completed'
  | 'Archived';

export interface Trip {
  id: string;
  title: string;
  /** Primary destination label for display (e.g. hero metadata). */
  destination: string;
  dateStart: string;
  dateEnd: string;
  heroImageUrl: string;
  status: TripLifecycleStatus;
  sharedViewEnabled: boolean;
  /** When false, journal cards show timestamp only (no author line). */
  showAuthorName: boolean;
  /** When false, journal cards hide created date/time. */
  showJournalEntryDate: boolean;
  /** Optional short trip blurb; omit or leave empty to hide on hero. */
  description?: string;
  /** Trip-scoped home/origin place ID — excluded from AI idea location balancing. */
  homePlaceId?: string;
}
