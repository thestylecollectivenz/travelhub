import type { ItineraryEntry, ItinerarySubItem } from '../models/ItineraryEntry';
import { formatCurrency } from './financialUtils';
import { formatTimeHHMM } from './itineraryTimeUtils';
import { paymentDueActionLabel } from './paymentDueLabels';
import { isLocationInfoEntry } from './locationInfoEntry';
import { isRichTextEditorEmpty } from './journalRichText';
import { richTextToPlainText } from './journalRichText';

export interface ItineraryDetailRow {
  label: string;
  value: string;
}

function row(label: string, value?: string | number | null): ItineraryDetailRow | undefined {
  const text = value === undefined || value === null ? '' : String(value).trim();
  if (!text) return undefined;
  return { label, value: text };
}

function ymd(value?: string): string | undefined {
  if (!value) return undefined;
  const d = new Date(`${value.slice(0, 10)}T00:00:00.000Z`);
  if (Number.isNaN(d.getTime())) return value.slice(0, 10);
  return d.toLocaleDateString('en-NZ', { day: 'numeric', month: 'short', year: 'numeric' });
}

function subItemRows(item: ItinerarySubItem, index: number, canSeeFinancials: boolean): ItineraryDetailRow[] {
  const prefix = `Option ${index + 1}`;
  const rows: Array<ItineraryDetailRow | undefined> = [
    row(`${prefix} — title`, item.title),
    row(`${prefix} — category`, item.category),
    row(`${prefix} — decision`, item.decisionStatus),
    row(`${prefix} — time`, item.startTime ? `${formatTimeHHMM(item.startTime)}${item.endTime ? ` – ${formatTimeHHMM(item.endTime)}` : ''}` : undefined),
    row(`${prefix} — duration`, item.duration),
    row(`${prefix} — location`, item.location),
    row(`${prefix} — address`, item.streetAddress),
    row(`${prefix} — supplier`, item.supplier),
    canSeeFinancials ? row(`${prefix} — payment`, item.paymentStatus) : undefined,
    canSeeFinancials && item.amount > 0
      ? row(`${prefix} — amount`, `${formatCurrency(item.amount, item.currency || 'NZD')}${item.costCertainty ? ` (${item.costCertainty})` : ''}`)
      : undefined,
    row(`${prefix} — booking required`, item.bookingRequired ? 'Yes' : undefined),
    row(`${prefix} — notes`, item.notes),
    row(`${prefix} — cancellation`, item.cancellationPolicy)
  ];
  return rows.filter((r): r is ItineraryDetailRow => Boolean(r));
}

export function buildItineraryEntryDetailRows(
  entry: ItineraryEntry,
  options: { canSeeFinancials: boolean }
): ItineraryDetailRow[] {
  if (isLocationInfoEntry(entry)) return [];

  const { canSeeFinancials } = options;
  const cat = entry.category;
  const rows: Array<ItineraryDetailRow | undefined> = [
    row('Title', entry.title),
    row('Category', cat),
    row('Decision', entry.decisionStatus),
    row('Start time', entry.timeStart ? formatTimeHHMM(entry.timeStart) : undefined),
    row('Duration', entry.duration),
    row('Arrival time', entry.arrivalTime ? formatTimeHHMM(entry.arrivalTime) : undefined),
    row('Arrival date', ymd(entry.arrivalDate)),
    row('Supplier / operator', entry.supplier),
    row('Location', entry.location),
    row('Street address', entry.streetAddress),
    row('Booking required', entry.bookingRequired ? 'Yes' : 'No'),
    row('Booking status', entry.bookingStatus),
    row('Booking due', ymd(entry.bookingDueDate)),
    row('Booking reference', entry.bookingReference),
    canSeeFinancials ? row('Payment status', entry.paymentStatus) : undefined,
    canSeeFinancials && entry.paymentDueDate
      ? row('Payment due', `${paymentDueActionLabel(entry)} ${ymd(entry.paymentDueDate)}`)
      : undefined,
    canSeeFinancials ? row('Payment due type', entry.paymentDueType) : undefined,
    canSeeFinancials && entry.amount > 0
      ? row('Amount', `${formatCurrency(entry.amount, entry.currency)}${entry.costCertainty ? ` (${entry.costCertainty})` : ''}`)
      : undefined,
    canSeeFinancials && entry.amountPaid
      ? row('Amount paid', formatCurrency(entry.amountPaid, entry.paymentCurrency || entry.currency))
      : undefined,
    canSeeFinancials && entry.unitType && entry.unitAmount
      ? row('Unit pricing', `${formatCurrency(entry.unitAmount, entry.currency)} · ${entry.unitType}`)
      : undefined,
    row('Check-in date', ymd(entry.dateStart)),
    row('Check-out date', ymd(entry.dateEnd)),
    row('Check-in time', entry.checkInTime ? formatTimeHHMM(entry.checkInTime) : undefined),
    row('Check-out time', entry.checkOutTime ? formatTimeHHMM(entry.checkOutTime) : undefined),
    row('Room type', entry.roomType),
    row('Phone', entry.phoneNumber),
    row('Booking mechanism', entry.bookingMechanism),
    row('Perks included', entry.perksIncluded),
    row('Flight numbers', entry.flightNumbers),
    row('Cabin class', entry.cabinClass),
    row('Check-in closes', entry.checkInClosesTime ? formatTimeHHMM(entry.checkInClosesTime) : undefined),
    row('Bag check closes', entry.bagCheckClosesTime ? formatTimeHHMM(entry.bagCheckClosesTime) : undefined),
    row('Transport from', entry.transportFrom),
    row('Transport to', entry.transportTo),
    row('Transport mode', entry.transportMode),
    entry.transportTransfers !== undefined ? row('Transfers', String(entry.transportTransfers)) : undefined,
    row('Journey type', entry.journeyType),
    row('Return date', ymd(entry.returnDate)),
    row('Return departure', entry.returnTime ? formatTimeHHMM(entry.returnTime) : undefined),
    row('Return arrival', entry.returnArrivalTime ? formatTimeHHMM(entry.returnArrivalTime) : undefined),
    row('Embark date', ymd(entry.embarksDate)),
    row('Disembark date', ymd(entry.disembarksDate)),
    row('Cruise reference', entry.cruiseReference),
    row('Cruise line', entry.cruiseLineName),
    row('Ship', entry.shipName),
    row('Cabin', entry.cabinTypeAndNumber),
    row('Package', entry.packageName),
    row('Package inclusions', entry.packageInclusions),
    row('Cancellation policy', entry.cancellationPolicy),
    entry.cancellationDeadline ? row('Cancellation deadline', entry.cancellationDeadline.replace('T', ' ').slice(0, 16)) : undefined,
    !isRichTextEditorEmpty(entry.notes) ? row('Notes', richTextToPlainText(entry.notes)) : undefined
  ];

  const base = rows.filter((r): r is ItineraryDetailRow => Boolean(r));
  const subs = (entry.subItems ?? []).flatMap((s, i) => subItemRows(s, i, canSeeFinancials));
  return [...base, ...subs];
}
