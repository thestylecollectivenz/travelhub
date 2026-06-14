export type TripDayType = 'PlacePort' | 'Sea' | 'TravelTransit' | 'PreTrip';

export type DayPlanningStatus = 'NotStarted' | 'InProgress' | 'Complete';

export interface TripDay {
  id: string;
  tripId: string;
  dayNumber: number;
  calendarDate: string;
  displayTitle: string;
  dayType: TripDayType;
  primaryPlaceId?: string;
  additionalPlaceIds?: string[];
  planningStatus?: DayPlanningStatus;
}
