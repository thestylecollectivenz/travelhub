import type { EntryDocument } from '../models/EntryDocument';
import type { ItineraryBookingStatus, ItineraryEntry } from '../models/ItineraryEntry';

export function parseBookingStatusValue(raw: unknown): ItineraryBookingStatus | undefined {
  const s = String(raw ?? '').trim().toLowerCase();
  if (s === 'booked') return 'Booked';
  if (s === 'not booked' || s === 'not_booked') return 'Not booked';
  return undefined;
}

/** Resolve booking status from explicit field plus booking signals on the row. */
export function resolveBookingStatusFromItem(item: Record<string, unknown>): ItineraryBookingStatus {
  const explicit = parseBookingStatusValue(item.BookingStatus);
  if (explicit === 'Booked') return 'Booked';

  const hasRef = Boolean(
    String(item.BookingReference ?? item.CruiseReference ?? '')
      .trim()
  );
  if (hasRef) return 'Booked';

  const mechanism = String(item.BookingMechanism ?? '').trim();
  if (mechanism) return 'Booked';

  const payment = String(item.PaymentStatus ?? '')
    .trim()
    .toLowerCase();
  if (
    item.BookingRequired === true &&
    (payment === 'fully paid' || payment === 'part paid' || payment === 'part_paid' || payment === 'fully_paid')
  ) {
    return 'Booked';
  }

  if (explicit === 'Not booked') return 'Not booked';
  return 'Not booked';
}

export function effectiveBookingStatus(
  entry: ItineraryEntry,
  options?: { hasConfirmationDoc?: boolean }
): ItineraryBookingStatus {
  if (entry.bookingStatus === 'Booked') return 'Booked';
  if (options?.hasConfirmationDoc) return 'Booked';
  if ((entry.bookingReference || entry.cruiseReference || '').trim()) return 'Booked';
  if ((entry.bookingMechanism || '').trim()) return 'Booked';
  if (
    entry.bookingRequired &&
    (entry.paymentStatus === 'Fully paid' || entry.paymentStatus === 'Part paid')
  ) {
    return 'Booked';
  }
  return 'Not booked';
}

export function findConfirmationDocument(documents: EntryDocument[]): EntryDocument | undefined {
  return documents.find((d) => {
    if (d.documentType === 'Confirmation' || d.documentType === 'Ticket') return true;
    const label = `${d.title || ''} ${d.fileName || ''}`.toLowerCase();
    return /confirm|voucher|booking|itinerary/.test(label);
  });
}

export function bookingPartnerSearchUrls(placeName: string, checkIn?: string, checkOut?: string): Array<{
  id: string;
  label: string;
  href: string;
}> {
  const q = encodeURIComponent(placeName.trim() || 'hotel');
  const inYmd = (checkIn || '').slice(0, 10);
  const outYmd = (checkOut || '').slice(0, 10);
  const expedia = inYmd && outYmd
    ? `https://www.expedia.com/Hotel-Search?destination=${q}&startDate=${inYmd}&endDate=${outYmd}`
    : `https://www.expedia.com/Hotel-Search?destination=${q}`;
  const bookingCom = inYmd && outYmd
    ? `https://www.booking.com/searchresults.html?ss=${q}&checkin=${inYmd}&checkout=${outYmd}`
    : `https://www.booking.com/searchresults.html?ss=${q}`;
  return [
    { id: 'expedia', label: 'Expedia', href: expedia },
    { id: 'booking', label: 'Booking.com', href: bookingCom }
  ];
}
