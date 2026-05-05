export type ItineraryDecisionStatus = 'Idea' | 'Planned' | 'Confirmed';

export type ItineraryBookingStatus = 'Not booked' | 'Booked';

export type ItineraryPaymentStatus = 'Not paid' | 'Part paid' | 'Fully paid' | 'Free';

export type ItineraryUnitType = 'PerPerson' | 'PerNight' | 'PerDay';

export type CabinClass = 'economy' | 'premium_economy' | 'business';

export type TransportJourneyType = 'oneway' | 'return';

export interface ItinerarySubItem {
  id: string;
  title: string;
  /** Optional HH:MM start time used by Day Planner plotting. */
  startTime?: string;
  /** Optional HH:MM end time used by Day Planner plotting. */
  endTime?: string;
  decisionStatus: ItineraryDecisionStatus;
  paymentStatus: ItineraryPaymentStatus;
  amount: number;
  amountPaid?: number;
  currency: string;
  notes?: string;
  groupLabel?: string;
  /** When true, surfaced on the option row and in previews (P7-9). */
  bookingRequired?: boolean;
}

export interface ItineraryEntry {
  id: string;
  dayId: string;
  tripId: string;
  title: string;
  category: string;
  timeStart: string;
  arrivalTime?: string;
  arrivalDate?: string;
  embarksDate?: string;
  disembarksDate?: string;
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
  paymentCurrency?: string;
  amountPaidConverted?: number;
  currency: string;
  /** Check-in/start date in YYYY-MM-DD form (persisted as ISO date in SharePoint). */
  dateStart?: string;
  /** Check-out/end date in YYYY-MM-DD form (persisted as ISO date in SharePoint). */
  dateEnd?: string;
  unitType?: ItineraryUnitType;
  unitAmount?: number;
  sortOrder: number;
  parentEntryId?: string;
  subItems?: ItinerarySubItem[];
  /** Shared PNR / reference (Accommodation, Flights, Activities). */
  bookingReference?: string;
  roomType?: string;
  /** Accommodation check-in time (HH:MM). */
  checkInTime?: string;
  /** Accommodation check-out time (HH:MM). */
  checkOutTime?: string;
  /** Street or property address (maps link derived in UI). */
  streetAddress?: string;
  flightNumbers?: string;
  /** Flights: latest time to complete check-in (HH:MM). */
  checkInClosesTime?: string;
  cabinClass?: CabinClass;
  journeyType?: TransportJourneyType;
  /** Return leg date (YYYY-MM-DD) when journeyType is return. */
  returnDate?: string;
  /** Return leg departure time (HH:MM). */
  returnTime?: string;
  /** Accommodation — multi-line (SharePoint Note). */
  perksIncluded?: string;
  cancellationPolicy?: string;
  /** ISO 8601 local-ish string for datetime-local / SharePoint DateTime. */
  cancellationDeadline?: string;
  cruiseReference?: string;
  cruiseLineName?: string;
  shipName?: string;
  cabinTypeAndNumber?: string;
  packageName?: string;
  packageInclusions?: string;
  transportFrom?: string;
  transportTo?: string;
  transportMode?: string;
}
