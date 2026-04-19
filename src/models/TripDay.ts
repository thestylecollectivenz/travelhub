export type TripDayType = 'PlacePort' | 'Sea' | 'TravelTransit';

export interface TripDay {
  id: string;
  tripId: string;
  dayNumber: number;
  calendarDate: string;
  displayTitle: string;
  dayType: TripDayType;
}
