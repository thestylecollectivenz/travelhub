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
  const from = isReturnLeg ? entry.transportTo || '—' : entry.transportFrom || '—';
  const to = isReturnLeg ? entry.transportFrom || '—' : entry.transportTo || '—';
  const summaryDate = isReturnLeg ? ymd(entry.returnDate || calendarDate) : ymd(entry.dateStart || calendarDate);
  const effectiveTime = formatTimeHHMM(
    effectiveTransportLegTime(entry, calendarDate, tripDays, leg)
  );
  const summaryTime = effectiveTime || '—';
  const mode = (entry.transportMode || '').trim();
  const modeSubtitle = mode || 'Transport';
  const locationLine = (entry.location || entry.streetAddress || '').trim() || '—';

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
      label: formatDisplayLabel(booked),
      tone: bookingPillTone(booked)
    },
    supplier: (entry.supplier || '').trim() || '—',
    paymentDue: entry.paymentDueDate
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
