export type ItineraryDecisionStatus = 'Idea' | 'Planned' | 'Confirmed';

export type ItineraryBookingStatus = 'Not booked' | 'Booked';

export type ItineraryPaymentStatus = 'Not paid' | 'Part paid' | 'Fully paid' | 'Free';

export type ItineraryUnitType = 'PerPerson' | 'PerNight' | 'PerDay';

export interface ItinerarySubItem {
  id: string;
  title: string;
  decisionStatus: ItineraryDecisionStatus;
  paymentStatus: ItineraryPaymentStatus;
  amount: number;
  amountPaid?: number;
  currency: string;
  notes?: string;
  groupLabel?: string;
}

export interface ItineraryEntry {
  id: string;
  dayId: string;
  tripId: string;
  title: string;
  category: string;
  timeStart: string;
  duration: string;
  supplier: string;
  /** Location or route detail (optional). */
  location?: string;
  notes: string;
  decisionStatus: ItineraryDecisionStatus;
  bookingRequired: boolean;
  bookingStatus: ItineraryBookingStatus;
  paymentStatus: ItineraryPaymentStatus;
  amount: number;
  amountPaid?: number;
  currency: string;
  unitType?: ItineraryUnitType;
  unitAmount?: number;
  sortOrder: number;
  parentEntryId?: string;
  subItems?: ItinerarySubItem[];
}
