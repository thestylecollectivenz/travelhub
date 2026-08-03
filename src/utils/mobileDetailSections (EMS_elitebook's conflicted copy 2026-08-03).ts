import type { ItineraryEntry } from '../models/ItineraryEntry';
import { formatCurrency } from './financialUtils';
import { formatTimeHHMM } from './itineraryTimeUtils';
import { paymentDueActionLabel } from './paymentDueLabels';
import { effectiveBookingStatus } from './bookingStatusUtils';
import { formatCabinClass, formatDisplayLabel, formatJourneyType, isReturnTransportLeg } from './mobileDisplayFormat';

export interface MobileStatItem {
  label: string;
  value: string;
}

export interface MobileDetailField {
  label: string;
  value: string;
  highlight?: boolean;
}

export interface MobileDetailRowPair {
  left?: MobileDetailField;
  right?: MobileDetailField;
}

export interface MobilePlannedActivity {
  id: string;
  title: string;
  meta?: string;
}

export interface MobileDetailSection {
  id: string;
  title: string;
  statusPill?: { label: string; tone: 'green' | 'rust' | 'red' | 'neutral' };
  stats?: MobileStatItem[];
  rows?: MobileDetailRowPair[];
  fullWidthFields?: MobileDetailField[];
}

export interface MobileCardSectionsResult {
  stats: MobileStatItem[];
  sections: MobileDetailSection[];
  plannedActivities: MobilePlannedActivity[];
  showStatsBar: boolean;
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

function pair(left?: MobileDetailField, right?: MobileDetailField): MobileDetailRowPair | undefined {
  if (!left && !right) return undefined;
  return { left, right };
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

function balanceDue(entry: ItineraryEntry): number {
  return Math.max(0, (entry.amount || 0) - (entry.amountPaid || 0));
}

function standardBookingRows(
  entry: ItineraryEntry,
  canSeeFinancials: boolean,
  hasConfirmationDoc: boolean,
  options?: { includeSupplier?: boolean }
): MobileDetailSection | undefined {
  const includeSupplier = options?.includeSupplier !== false;
  const booked = effectiveBookingStatus(entry, { hasConfirmationDoc });
  const rows: Array<MobileDetailRowPair | undefined> = [
    pair(
      field('Booking required', entry.bookingRequired ? 'Yes' : 'No'),
      field('Booking status', formatDisplayLabel(booked), true)
    ),
    pair(
      includeSupplier ? field('Supplier', entry.supplier) : undefined,
      field('Booking reference', entry.bookingReference || entry.cruiseReference)
    )
  ];

  if (canSeeFinancials) {
    rows.push(
      pair(
        entry.amount > 0
          ? field(
              'Amount',
              `${formatCurrency(entry.amount, entry.currency)}${entry.costCertainty ? ` (${formatDisplayLabel(entry.costCertainty)})` : ''}`,
              true
            )
          : undefined,
        entry.amountPaid !== undefined && entry.amountPaid > 0
          ? field('Amount paid', formatCurrency(entry.amountPaid, entry.paymentCurrency || entry.currency))
          : undefined
      ),
      pair(
        entry.amount > 0 ? field('Balance due', formatCurrency(balanceDue(entry), entry.currency), balanceDue(entry) > 0) : undefined,
        entry.paymentDueDate
          ? field('Payment due', `${paymentDueActionLabel(entry)} ${ymd(entry.paymentDueDate)}`, entry.paymentStatus === 'Not paid')
          : field('Payment due', ymd(entry.bookingDueDate) ? `Book by ${ymd(entry.bookingDueDate)}` : undefined)
      )
    );
  } else {
    rows.push(pair(field('Booking due', ymd(entry.bookingDueDate))));
  }

  const fullWidthFields: MobileDetailField[] = [];
  const cancel = field('Cancellation policy', entry.cancellationPolicy);
  if (cancel) fullWidthFields.push(cancel);

  const resolvedRows = rows.filter((r): r is MobileDetailRowPair => Boolean(r));
  if (!resolvedRows.length && !fullWidthFields.length) return undefined;

  const statusPill = canSeeFinancials
    ? { label: formatDisplayLabel(entry.paymentStatus), tone: paymentPillTone(entry.paymentStatus) }
    : { label: formatDisplayLabel(booked), tone: bookingPillTone(booked) };

  return {
    id: 'booking',
    title: 'Booking & payment',
    statusPill,
    rows: resolvedRows,
    fullWidthFields: fullWidthFields.length ? fullWidthFields : undefined
  };
}

export function buildMobileCardSections(
  entry: ItineraryEntry,
  options: { canSeeFinancials: boolean; hasConfirmationDoc: boolean; calendarDate: string }
): MobileCardSectionsResult {
  const { canSeeFinancials, hasConfirmationDoc, calendarDate } = options;
  const cat = entry.category;
  const stats: MobileStatItem[] = [];
  const sections: MobileDetailSection[] = [];
  const plannedActivities: MobilePlannedActivity[] = [];
  let showStatsBar = true;

  const skipBooking = cat === 'Cruise port';
  if (!skipBooking) {
    const bookingSection = standardBookingRows(entry, canSeeFinancials, hasConfirmationDoc, {
      includeSupplier: cat !== 'Transport'
    });
    if (bookingSection) sections.push(bookingSection);
  }

  if (cat === 'Accommodation') {
    const n = nightsBetween(entry.dateStart, entry.dateEnd);
    if (n) stats.push({ label: 'Stay duration', value: `${n} night${n === 1 ? '' : 's'}` });
    if (entry.dateStart || entry.checkInTime) stats.push({ label: 'Check-in', value: ymdTime(entry.dateStart, entry.checkInTime) });
    if (entry.dateEnd || entry.checkOutTime) stats.push({ label: 'Check-out', value: ymdTime(entry.dateEnd, entry.checkOutTime) });
    const stayRows = [
      pair(field('Room type', entry.roomType), field('Transfers', entry.transportTransfers !== undefined ? String(entry.transportTransfers) : undefined))
    ].filter((r): r is MobileDetailRowPair => Boolean(r));
    if (stayRows.length) sections.push({ id: 'stay', title: 'Stay details', rows: stayRows });
    for (const sub of entry.subItems ?? []) {
      plannedActivities.push({
        id: sub.id,
        title: sub.title,
        meta: [sub.startTime ? formatTimeHHMM(sub.startTime) : '', sub.category || 'Activity'].filter(Boolean).join(' · ')
      });
    }
    if (plannedActivities.length) {
      sections.push({ id: 'planned', title: 'Activities planned', rows: [] });
    }
  } else if (cat === 'Flights') {
    showStatsBar = false;
    const flightRows = [
      pair(field('Supplier / operator', entry.supplier), field('Flight number', entry.flightNumbers)),
      pair(field('From', entry.transportFrom), field('To', entry.transportTo)),
      pair(field('Cabin class', formatCabinClass(entry.cabinClass)), field('Arrival date', ymd(entry.arrivalDate))),
      pair(
        field('Check-in closes', entry.checkInClosesTime ? formatTimeHHMM(entry.checkInClosesTime) : undefined),
        field('Bag check closes', entry.bagCheckClosesTime ? formatTimeHHMM(entry.bagCheckClosesTime) : undefined)
      )
    ].filter((r): r is MobileDetailRowPair => Boolean(r));
    if (flightRows.length) sections.push({ id: 'flight', title: 'Flight details', rows: flightRows });
  } else if (cat === 'Transport') {
    const isReturn = isReturnTransportLeg({ ...entry, calendarDate });
    const from = isReturn ? entry.transportTo : entry.transportFrom;
    const to = isReturn ? entry.transportFrom : entry.transportTo;
    const transportRows = [
      pair(field('Supplier / operator', entry.supplier), field('Transport mode', entry.transportMode)),
      pair(field('From', from), field('To', to)),
      pair(field('Outbound date', ymd(entry.dateStart)), field('Return date', ymd(entry.returnDate))),
      pair(
        field('Journey type', formatJourneyType(entry.journeyType)),
        entry.returnTime ? field('Return time', formatTimeHHMM(entry.returnTime)) : undefined
      )
    ].filter((r): r is MobileDetailRowPair => Boolean(r));
    if (transportRows.length) sections.push({ id: 'journey', title: 'Journey details', rows: transportRows });
  } else if (cat === 'Cruise') {
    const cruiseRows = [
      pair(field('Cruise line', entry.cruiseLineName), field('Ship', entry.shipName)),
      pair(field('Cruise reference', entry.cruiseReference), field('Cabin', entry.cabinTypeAndNumber)),
      pair(field('Embark date', ymd(entry.embarksDate)), field('Disembark date', ymd(entry.disembarksDate))),
      pair(field('Package', entry.packageName), undefined)
    ].filter((r): r is MobileDetailRowPair => Boolean(r));
    if (cruiseRows.length) sections.push({ id: 'cruise', title: 'Cruise overview', rows: cruiseRows });
    if (entry.packageInclusions) {
      sections.push({
        id: 'inclusions',
        title: 'Package inclusions',
        fullWidthFields: [field('Inclusions', entry.packageInclusions)!]
      });
    }
  } else if (cat === 'Cruise port') {
    showStatsBar = false;
    if (entry.timeStart) {
      const portRow = pair(field('Departure time', formatTimeHHMM(entry.timeStart)), field('Location', entry.location));
      if (portRow) {
        sections.push({
          id: 'port',
          title: 'Port details',
          rows: [portRow]
        });
      }
    }
    for (const sub of entry.subItems ?? []) {
      plannedActivities.push({
        id: sub.id,
        title: sub.title,
        meta: [sub.startTime ? formatTimeHHMM(sub.startTime) : '', sub.category || 'Activity'].filter(Boolean).join(' · ')
      });
    }
    if (plannedActivities.length) {
      sections.push({ id: 'planned', title: 'Activities planned', rows: [] });
    }
  } else if (cat === 'Food & Dining' || cat === 'Dining') {
    if (entry.timeStart) stats.push({ label: 'Start time', value: formatTimeHHMM(entry.timeStart) });
    if (entry.duration) stats.push({ label: 'Duration', value: entry.duration });
    if (canSeeFinancials && entry.paymentStatus) stats.push({ label: 'Payment status', value: formatDisplayLabel(entry.paymentStatus) });
    if (canSeeFinancials && entry.amount > 0) stats.push({ label: 'Amount', value: formatCurrency(entry.amount, entry.currency) });
    const diningRows = [
      pair(field('Location', entry.location || entry.streetAddress), field('Supplier / operator', entry.supplier)),
      pair(field('Duration', entry.duration), field('Start time', entry.timeStart ? formatTimeHHMM(entry.timeStart) : undefined))
    ].filter((r): r is MobileDetailRowPair => Boolean(r));
    if (diningRows.length) sections.push({ id: 'dining', title: 'Dining details', rows: diningRows });
  } else {
    if (entry.timeStart) stats.push({ label: 'Start time', value: formatTimeHHMM(entry.timeStart) });
    if (entry.duration) stats.push({ label: 'Duration', value: entry.duration });
    if (entry.arrivalTime) stats.push({ label: 'End time', value: formatTimeHHMM(entry.arrivalTime) });
    const overviewRows = [
      pair(field('Operator', entry.supplier), field('Booking reference', entry.bookingReference)),
      pair(field('Booking due', ymd(entry.bookingDueDate)), field('Location', entry.location)),
      pair(field('Meeting point', entry.streetAddress), undefined)
    ].filter((r): r is MobileDetailRowPair => Boolean(r));
    if (overviewRows.length) sections.push({ id: 'overview', title: 'Overview', rows: overviewRows });
  }

  return { stats, sections, plannedActivities, showStatsBar };
}
