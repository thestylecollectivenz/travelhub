import type { ItineraryEntry } from '../models/ItineraryEntry';
import { formatCurrency } from './financialUtils';
import { formatTimeHHMM } from './itineraryTimeUtils';
import { paymentDueActionLabel } from './paymentDueLabels';
import { effectiveBookingStatus } from './bookingStatusUtils';

export interface MobileStatItem {
  label: string;
  value: string;
}

export interface MobileDetailField {
  label: string;
  value: string;
  highlight?: boolean;
}

export interface MobileDetailSection {
  id: string;
  title: string;
  statusPill?: { label: string; tone: 'green' | 'rust' | 'red' | 'neutral' };
  stats?: MobileStatItem[];
  fields?: MobileDetailField[];
}

function ymd(value?: string): string {
  if (!value) return '';
  const d = new Date(`${value.slice(0, 10)}T00:00:00.000Z`);
  if (Number.isNaN(d.getTime())) return value.slice(0, 10);
  return d.toLocaleDateString('en-NZ', { day: 'numeric', month: 'short', year: 'numeric' });
}

function ymdTime(date?: string, time?: string): string {
  const d = ymd(date);
  if (!d) return time ? formatTimeHHMM(time) : '';
  if (!time) return d;
  return `${d}, ${formatTimeHHMM(time)}`;
}

function field(label: string, value?: string | number | null, highlight?: boolean): MobileDetailField | undefined {
  const text = value === undefined || value === null ? '' : String(value).trim();
  if (!text) return undefined;
  return { label, value: text, highlight };
}

function nightsBetween(start?: string, end?: string): number {
  if (!start || !end) return 0;
  const a = new Date(`${start.slice(0, 10)}T00:00:00.000Z`);
  const b = new Date(`${end.slice(0, 10)}T00:00:00.000Z`);
  if (Number.isNaN(a.getTime()) || Number.isNaN(b.getTime())) return 0;
  return Math.max(0, Math.floor((b.getTime() - a.getTime()) / 86400000));
}

function paymentPillTone(status: string): 'green' | 'rust' | 'red' | 'neutral' {
  if (status === 'Fully paid') return 'green';
  if (status === 'Part paid') return 'neutral';
  return 'rust';
}

function bookingPillTone(status: string): 'green' | 'rust' | 'red' | 'neutral' {
  if (status === 'Booked') return 'green';
  return 'red';
}

function bookingPaymentSection(
  entry: ItineraryEntry,
  canSeeFinancials: boolean,
  hasConfirmationDoc: boolean
): MobileDetailSection | undefined {
  const booked = effectiveBookingStatus(entry, { hasConfirmationDoc });
  const fields: Array<MobileDetailField | undefined> = [
    field('Booking required', entry.bookingRequired ? 'Yes' : 'No'),
    field('Booking status', booked),
    field('Booking reference', entry.bookingReference || entry.cruiseReference),
    canSeeFinancials ? field('Payment status', entry.paymentStatus, true) : undefined,
    canSeeFinancials && entry.paymentDueDate
      ? field('Payment due', `${paymentDueActionLabel(entry)} ${ymd(entry.paymentDueDate)}`, entry.paymentStatus === 'Not paid')
      : undefined,
    canSeeFinancials && entry.amount > 0
      ? field(
          'Amount',
          `${formatCurrency(entry.amount, entry.currency)}${entry.costCertainty ? ` (${entry.costCertainty})` : ''}`,
          true
        )
      : undefined,
    canSeeFinancials && entry.amountPaid
      ? field('Amount paid', formatCurrency(entry.amountPaid, entry.paymentCurrency || entry.currency))
      : undefined,
    canSeeFinancials && entry.unitType && entry.unitAmount
      ? field('Unit pricing', `${formatCurrency(entry.unitAmount, entry.currency)} per ${entry.unitType.replace('per ', '')}`)
      : undefined,
    field('Booking due', ymd(entry.bookingDueDate)),
    field('Supplier', entry.supplier)
  ];
  const resolved = fields.filter((f): f is MobileDetailField => Boolean(f));
  if (!resolved.length) return undefined;
  const statusPill = canSeeFinancials
    ? { label: entry.paymentStatus, tone: paymentPillTone(entry.paymentStatus) }
    : { label: booked, tone: bookingPillTone(booked) };
  return { id: 'booking', title: 'Booking & payment', statusPill, fields: resolved };
}

export function buildMobileCardSections(
  entry: ItineraryEntry,
  options: { canSeeFinancials: boolean; hasConfirmationDoc: boolean }
): { stats: MobileStatItem[]; sections: MobileDetailSection[] } {
  const { canSeeFinancials, hasConfirmationDoc } = options;
  const cat = entry.category;
  const stats: MobileStatItem[] = [];
  const sections: MobileDetailSection[] = [];

  const bookingSection = bookingPaymentSection(entry, canSeeFinancials, hasConfirmationDoc);
  if (bookingSection) sections.push(bookingSection);

  if (cat === 'Accommodation') {
    const n = nightsBetween(entry.dateStart, entry.dateEnd);
    if (n) stats.push({ label: 'Stay duration', value: `${n} night${n === 1 ? '' : 's'}` });
    if (entry.dateStart || entry.checkInTime) {
      stats.push({ label: 'Check-in', value: ymdTime(entry.dateStart, entry.checkInTime) });
    }
    if (entry.dateEnd || entry.checkOutTime) {
      stats.push({ label: 'Check-out', value: ymdTime(entry.dateEnd, entry.checkOutTime) });
    }
    const stayFields = [
      field('Room type', entry.roomType),
      field('Booking required', entry.bookingRequired ? 'Yes' : 'No'),
      field('Transfers', entry.transportTransfers !== undefined ? String(entry.transportTransfers) : undefined),
      field('Cancellation', entry.cancellationPolicy)
    ].filter((f): f is MobileDetailField => Boolean(f));
    if (stayFields.length) sections.push({ id: 'stay', title: 'Stay details', fields: stayFields });
  } else if (cat === 'Flights') {
    if (entry.timeStart) stats.push({ label: 'Departs', value: formatTimeHHMM(entry.timeStart) });
    if (entry.duration) stats.push({ label: 'Duration', value: entry.duration });
    if (entry.arrivalTime) stats.push({ label: 'Arrives', value: formatTimeHHMM(entry.arrivalTime) });
    if (entry.transportTransfers !== undefined) stats.push({ label: 'Transfers', value: String(entry.transportTransfers) });
    const flightFields = [
      field('Supplier / operator', entry.supplier),
      field('Flight number', entry.flightNumbers),
      field('Cabin class', entry.cabinClass),
      field('From', entry.transportFrom),
      field('To', entry.transportTo),
      field('Transfers', entry.transportTransfers !== undefined ? String(entry.transportTransfers) : undefined),
      field('Check-in closes', entry.checkInClosesTime ? formatTimeHHMM(entry.checkInClosesTime) : undefined),
      field('Bag check closes', entry.bagCheckClosesTime ? formatTimeHHMM(entry.bagCheckClosesTime) : undefined),
      field('Arrival date', ymd(entry.arrivalDate))
    ].filter((f): f is MobileDetailField => Boolean(f));
    if (flightFields.length) sections.push({ id: 'flight', title: 'Flight details', fields: flightFields });
  } else if (cat === 'Transport') {
    if (entry.timeStart) stats.push({ label: 'Start time', value: formatTimeHHMM(entry.timeStart) });
    if (entry.duration) stats.push({ label: 'Duration', value: entry.duration });
    if (entry.arrivalTime) stats.push({ label: 'Arrival time', value: formatTimeHHMM(entry.arrivalTime) });
    if (entry.transportTransfers !== undefined) stats.push({ label: 'Transfers', value: String(entry.transportTransfers) });
    const transportFields = [
      field('Supplier / operator', entry.supplier),
      field('From', entry.transportFrom),
      field('To', entry.transportTo),
      field('Transport mode', entry.transportMode),
      field('Journey type', entry.journeyType),
      field('Outbound date', ymd(entry.dateStart)),
      field('Return date', ymd(entry.returnDate))
    ].filter((f): f is MobileDetailField => Boolean(f));
    if (transportFields.length) sections.push({ id: 'journey', title: 'Journey details', fields: transportFields });
  } else if (cat === 'Cruise' || cat === 'Cruise port') {
    const cruiseFields = [
      field('Cruise line', entry.cruiseLineName),
      field('Ship', entry.shipName),
      field('Cabin', entry.cabinTypeAndNumber),
      field('Embark date', ymd(entry.embarksDate)),
      field('Disembark date', ymd(entry.disembarksDate)),
      field('Package', entry.packageName),
      field('Package inclusions', entry.packageInclusions),
      field('Cruise reference', entry.cruiseReference)
    ].filter((f): f is MobileDetailField => Boolean(f));
    if (cruiseFields.length) sections.push({ id: 'cruise', title: 'Cruise overview', fields: cruiseFields });
  } else if (cat === 'Food & Dining' || cat === 'Dining') {
    if (entry.timeStart) stats.push({ label: 'Start time', value: formatTimeHHMM(entry.timeStart) });
    if (entry.duration) stats.push({ label: 'Duration', value: entry.duration });
    if (canSeeFinancials && entry.paymentStatus) stats.push({ label: 'Payment status', value: entry.paymentStatus });
    if (canSeeFinancials && entry.amount > 0) {
      stats.push({ label: 'Amount', value: formatCurrency(entry.amount, entry.currency) });
    }
    const diningFields = [
      field('Category', cat),
      field('Supplier / operator', entry.supplier),
      field('Duration', entry.duration),
      field('Start time', entry.timeStart ? formatTimeHHMM(entry.timeStart) : undefined)
    ].filter((f): f is MobileDetailField => Boolean(f));
    if (diningFields.length) sections.push({ id: 'dining', title: 'Dining details', fields: diningFields });
  } else {
    if (entry.timeStart) stats.push({ label: 'Start time', value: formatTimeHHMM(entry.timeStart) });
    if (entry.duration) stats.push({ label: 'Duration', value: entry.duration });
    if (entry.arrivalTime) stats.push({ label: 'End time', value: formatTimeHHMM(entry.arrivalTime) });
    const overviewFields = [
      field('Operator', entry.supplier),
      field('Booking required', entry.bookingRequired ? 'Yes' : 'No'),
      field('Booking due', ymd(entry.bookingDueDate)),
      field('Location', entry.location),
      field('Meeting point', entry.streetAddress)
    ].filter((f): f is MobileDetailField => Boolean(f));
    if (overviewFields.length) sections.push({ id: 'overview', title: 'Overview', fields: overviewFields });
  }

  return { stats, sections };
}
