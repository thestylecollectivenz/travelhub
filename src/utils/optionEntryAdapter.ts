import type { ItineraryEntry, ItinerarySubItem } from '../models/ItineraryEntry';
import { arrivalTimeFromDuration, isDurationExpressionComplete } from './durationFromTimes';

/** Map a related option to a full entry shape for ItineraryCardEdit. */
export function subItemToEditableEntry(parent: ItineraryEntry, sub: ItinerarySubItem): ItineraryEntry {
  return {
    id: sub.id,
    dayId: parent.dayId,
    tripId: parent.tripId,
    title: sub.title,
    category: sub.category?.trim() || 'Other',
    timeStart: sub.startTime ?? '',
    arrivalTime: sub.endTime,
    duration: sub.duration?.trim() || '',
    supplier: sub.supplier?.trim() || '',
    location: sub.location,
    streetAddress: sub.streetAddress,
    notes: sub.notes ?? '',
    decisionStatus: sub.decisionStatus,
    bookingRequired: sub.bookingRequired === true,
    bookingStatus: 'Not booked',
    paymentStatus: sub.paymentStatus,
    amount: sub.amount,
    amountPaid: sub.amountPaid,
    currency: sub.currency || parent.currency || 'NZD',
    costCertainty: sub.costCertainty,
    cancellationPolicy: sub.cancellationPolicy,
    sortOrder: 0,
    parentEntryId: parent.id
  };
}

/** Map ItineraryCardEdit draft back to a related option row. */
export function editableEntryToSubItem(
  entry: ItineraryEntry,
  prior?: ItinerarySubItem,
  calendarDate?: string
): ItinerarySubItem {
  const duration = entry.duration?.trim() || undefined;
  let endTime = entry.arrivalTime?.trim() || undefined;
  if (duration && entry.timeStart?.trim() && !endTime && calendarDate && isDurationExpressionComplete(duration)) {
    const computed = arrivalTimeFromDuration({
      startDate: calendarDate,
      startTime: entry.timeStart,
      duration
    });
    if (computed) endTime = computed.arrivalTime;
  }

  return {
    id: entry.id,
    title: entry.title,
    category: entry.category?.trim() || 'Other',
    startTime: entry.timeStart?.trim() || undefined,
    endTime,
    duration,
    location: entry.location?.trim() || undefined,
    streetAddress: entry.streetAddress?.trim() || undefined,
    supplier: entry.supplier?.trim() || undefined,
    notes: entry.notes?.trim() || undefined,
    decisionStatus: entry.decisionStatus,
    paymentStatus: entry.paymentStatus,
    amount: entry.amount,
    amountPaid: entry.amountPaid,
    currency: entry.currency,
    costCertainty: entry.costCertainty,
    bookingRequired: entry.bookingRequired === true,
    cancellationPolicy: entry.cancellationPolicy?.trim() || undefined,
    groupLabel: prior?.groupLabel,
    sortOrder: prior?.sortOrder
  };
}
