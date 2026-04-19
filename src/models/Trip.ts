export type TripLifecycleStatus =
  | 'Planning'
  | 'Upcoming'
  | 'In Progress'
  | 'Completed'
  | 'Archived';

export interface Trip {
  id: string;
  title: string;
  dateStart: string;
  dateEnd: string;
  heroImageUrl: string;
  status: TripLifecycleStatus;
  sharedViewEnabled: boolean;
}
