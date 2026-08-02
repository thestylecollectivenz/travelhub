import type { ItineraryEntry } from '../models/ItineraryEntry';
import type { EntryDocument } from '../models/EntryDocument';
import type { EntryLink } from '../models/EntryLink';
import { formatCurrency } from './financialUtils';
import { paymentDueActionLabel } from './paymentDueLabels';
import { formatDisplayLabel, formatJourneyType, isReturnTransportLeg } from './mobileDisplayFormat';
import { effectiveBookingStatus } from './bookingStatusUtils';
import { formatTimeHHMM } from './itineraryTimeUtils';
import { effectiveTransportLegTime } from './itineraryDayEntries';
import type { TripDay } from '../models/TripDay';
import { resolveTransportFromTo, parseTransportEndpointsFromTitle } from './parseTransportEndpoints';

export interface TransportJourneyRow {
  label: string;
  value: string;
}

export interface TransportBookingPaymentModel {
  bookingReference: string;
  bookingStatus: { label: string; tone: 'green' | 'rust' | 'red' | 'neutral' };
  supplier?: string;
  paymentDue?: string;
  paymentStatus?: { label: string; tone: 'green' | 'rust' | 'red' | 'neutral' };
  amountPrimary?: string;
  amountHome?: string;
  showPayment: boolean;
}

function ymd(value?: string): string {
  if (!value) return '—';
  const d = new Date(`${value.slice(0, 10)}T00:00:00.000Z`);
  if (Number.isNaN(d.getTime())) return value.slice(0, 10);
  return d.toLocaleDateString('en-NZ', { day: 'numeric', month: 'short', year: 'numeric' });
}

function paymentPillTone(status: string): 'green' | 'rust' | 'red' | 'neutral' {
  if (status === 'Fully paid' || status === 'Free') return 'green';
  if (status === 'Part paid') return 'neutral';
  return 'rust';
}

function bookingPillTone(status: string): 'green' | 'rust' | 'red' | 'neutral' {
  if (status === 'Booked') return 'green';
  return 'neutral';
}

function transportLeg(entry: ItineraryEntry, calendarDate: string): 'outbound' | 'return' | undefined {
  if (isReturnTransportLeg({ ...entry, category: 'Transport', calendarDate })) return 'return';
  return 'outbound';
}

export function findTransportTimetableHref(docs: EntryDocument[], links: EntryLink[]): string | undefined {
  for (const d of docs) {
    if (d.fileUrl) return d.fileUrl;
  }
  for (const l of links) {
    if (/timetable|schedule|availability|booking|ticket/i.test(`${l.linkTitle || ''} ${l.title || ''} ${l.url}`)) {
      return l.url;
    }
  }
  return links[0]?.url;
}

export function transportLuggageNote(entry: ItineraryEntry): string {
  const notes = (entry.notes || '').replace(/<[^>]+>/g, ' ').trim();
  if (notes.length > 0 && notes.length <= 180) return notes;
  return 'Check luggage allowance and check-in requirements with your operator before travel.';
}

export function buildTransportDetailData(
  entry: ItineraryEntry,
  calendarDate: string,
  options: {
    canSeeFinancials: boolean;
    hasConfirmationDoc: boolean;
    tripDays?: TripDay[];
    convertToHomeCurrency?: (amount: number, currency: string) => number;
    homeCurrency?: string;
  }
): {
  isReturnLeg: boolean;
  summaryDate: string;
  summaryTime: string;
  routeFrom: string;
  routeTo: string;
  modeSubtitle: string;
  locationLine: string;
  journeyRows: TransportJourneyRow[];
  luggageNote: string;
  bookingPayment: TransportBookingPaymentModel;
  timetableHref?: string;
} {
  const { canSeeFinancials, hasConfirmationDoc, tripDays, convertToHomeCurrency, homeCurrency } = options;
  const leg = transportLeg(entry, calendarDate);
  const isReturnLeg = leg === 'return';
  const resolved = resolveTransportFromTo(entry);
  const from = isReturnLeg
    ? resolved.to !== '—'
      ? resolved.to
      : '—'
    : resolved.from;
  const to = isReturnLeg
    ? resolved.from !== '—'
      ? resolved.from
      : '—'
    : resolved.to;
  const summaryDate = isReturnLeg ? ymd(entry.returnDate || calendarDate) : ymd(entry.dateStart || calendarDate);
  const effectiveTime = formatTimeHHMM(
    effectiveTransportLegTime(entry, calendarDate, tripDays, leg)
  );
  const summaryTime = effectiveTime || '—';
  const mode = (entry.transportMode || '').trim();
  const modeSubtitle = mode || 'Transport';
  const street = (entry.streetAddress || '').trim();
  const loc = (entry.location || '').trim();
  const supplier = (entry.supplier || '').trim();
  const routeBits = new Set(
    [from, to, supplier].map((s) => s.toLowerCase()).filter((s) => s && s !== '—')
  );
  // Prefer street address; only show location when it isn't duplicating From/To/supplier.
  let locationLine = '—';
  if (street && !routeBits.has(street.toLowerCase())) {
    locationLine = street;
  } else if (loc && !routeBits.has(loc.toLowerCase()) && !parseTransportEndpointsFromTitle(loc).from) {
    locationLine = loc;
  } else if (from !== '—' || to !== '—') {
    locationLine = from !== '—' && to !== '—' ? `${from} → ${to}` : from !== '—' ? from : to;
  }

  const journeyRows: TransportJourneyRow[] = [
    { label: 'From', value: from },
    { label: 'To', value: to },
    { label: 'Journey type', value: formatJourneyType(entry.journeyType) || '—' },
    { label: 'Outbound', value: ymd(entry.dateStart) },
    { label: 'Return', value: entry.returnDate ? ymd(entry.returnDate) : '—' },
    {
      label: 'Duration',
      value: (entry.duration || '').trim() || '—'
    }
  ];

  if (isReturnLeg && entry.returnTime) {
    journeyRows.push({ label: 'Return departure', value: formatTimeHHMM(entry.returnTime) });
  }
  if (entry.returnArrivalTime) {
    journeyRows.push({ label: 'Return arrival', value: formatTimeHHMM(entry.returnArrivalTime) });
  }

  const booked = effectiveBookingStatus(entry, { hasConfirmationDoc });
  const currency = (entry.currency || 'NZD').toUpperCase();
  const home = (homeCurrency || 'NZD').toUpperCase();

  let amountPrimary: string | undefined;
  let amountHome: string | undefined;
  if (canSeeFinancials && entry.amount > 0) {
    amountPrimary = `${formatCurrency(entry.amount, currency)} ${currency}`;
    if (convertToHomeCurrency && currency !== home) {
      const homeTotal = convertToHomeCurrency(entry.amount, currency);
      if (Number.isFinite(homeTotal)) {
        amountHome = `≈ ${formatCurrency(homeTotal, home)} ${home}`;
      }
    }
  }

  const bookingPayment: TransportBookingPaymentModel = {
    bookingReference: (entry.bookingReference || '').trim() || '—',
    bookingStatus: {
      label: booked ? 'Booked' : entry.bookingStatus || 'Not booked',
      tone: bookingPillTone(booked ? 'Booked' : entry.bookingStatus)
    },
    supplier: supplier || '—',
    paymentDue: entry.payOnsite
      ? 'Pay onsite'
      : entry.paymentDueDate
        ? `${paymentDueActionLabel(entry)} ${ymd(entry.paymentDueDate)}`
        : entry.bookingDueDate
          ? ymd(entry.bookingDueDate)
          : '—',
    paymentStatus: canSeeFinancials
      ? {
          label: formatDisplayLabel(entry.paymentStatus),
          tone: paymentPillTone(entry.paymentStatus)
        }
      : undefined,
    amountPrimary,
    amountHome,
    showPayment: canSeeFinancials
  };

  return {
    isReturnLeg,
    summaryDate,
    summaryTime,
    routeFrom: from,
    routeTo: to,
    modeSubtitle,
    locationLine,
    journeyRows,
    luggageNote: transportLuggageNote(entry),
    bookingPayment,
    timetableHref: undefined
  };
}
