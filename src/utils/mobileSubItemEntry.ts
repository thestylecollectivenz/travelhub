import type { ItineraryEntry, ItinerarySubItem } from '../models/ItineraryEntry';

/** Present an itinerary option/sub-item as a standalone card for mobile detail view. */
export function itineraryEntryFromSubItem(parent: ItineraryEntry, sub: ItinerarySubItem): ItineraryEntry {
  return {
    ...parent,
    title: sub.title || parent.title,
    category: (sub.category?.trim() || 'Activities'),
    timeStart: sub.startTime || parent.timeStart,
    arrivalTime: sub.endTime || parent.arrivalTime,
    duration: sub.duration || parent.duration,
    decisionStatus: sub.decisionStatus,
    paymentStatus: sub.paymentStatus,
    amount: sub.amount,
    amountPaid: sub.amountPaid,
    currency: sub.currency || parent.currency,
    costCertainty: sub.costCertainty ?? parent.costCertainty,
    supplier: sub.supplier || parent.supplier,
    location: sub.location || parent.location,
    streetAddress: sub.streetAddress || parent.streetAddress,
    notes: sub.notes || '',
    bookingRequired: sub.bookingRequired ?? parent.bookingRequired,
    cancellationPolicy: sub.cancellationPolicy ?? parent.cancellationPolicy,
    subItems: []
  };
}
