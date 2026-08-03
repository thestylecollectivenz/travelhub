import type { ItineraryEntry } from '../models/ItineraryEntry';
import type { EntryDocument } from '../models/EntryDocument';
import type { EntryLink } from '../models/EntryLink';
import { formatCurrency } from './financialUtils';
import { paymentDueReadLabel } from './paymentDueLabels';
import { formatDisplayLabel } from './mobileDisplayFormat';
import { effectiveBookingStatus } from './bookingStatusUtils';
import { formatTimeHHMM } from './itineraryTimeUtils';
import { resolveTransportFromTo } from './parseTransportEndpoints';

function ymdLong(value?: string): string {
  if (!value) return '—';
  const d = new Date(`${value.slice(0, 10)}T12:00:00`);
  if (Number.isNaN(d.getTime())) return value.slice(0, 10);
  return d.toLocaleDateString('en-NZ', { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' });
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

function stripHtml(html?: string): string {
  return (html || '').replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
}

/** Pull a terminal / baggage line from notes when dedicated fields are empty. */
function extractFlightNoteHints(notes?: string): { terminal?: string; baggage?: string } {
  const text = stripHtml(notes);
  if (!text) return {};
  const terminal =
    text.match(/\b(?:terminal|changi terminal|terminal\s*\d+)\b[^.!?\n]*/i)?.[0]?.trim() ||
    text.match(/\b(?:leaves?|departs?|arrives?)\s+(?:from|at)\s+[^.!?\n]+/i)?.[0]?.trim();
  const baggage =
    text.match(/\b(?:baggage|bags?|luggage|checked bags?)[^.!?\n]*/i)?.[0]?.trim() ||
    text.match(/\b\d+\s*x\s*\d+\s*kg\b[^.!?\n]*/i)?.[0]?.trim();
  return { terminal, baggage };
}

export interface FlightLegPoint {
  time: string;
  date: string;
  location: string;
  sub?: string;
  dayOffset?: number;
}

export function buildFlightDetailData(
  entry: ItineraryEntry,
  calendarDate: string,
  options: {
    canSeeFinancials: boolean;
    hasConfirmationDoc: boolean;
    convertToHomeCurrency?: (amount: number, currency: string) => number;
    homeCurrency?: string;
  }
): {
  title: string;
  departs: FlightLegPoint;
  arrives: FlightLegPoint;
  duration: string;
  stopLabel: string;
  ticketingAirline: string;
  operatingAirline: string;
  bookingPayment: {
    bookingReference: string;
    bookingStatus: { label: string; tone: 'green' | 'rust' | 'red' | 'neutral' };
    paymentStatus?: { label: string; tone: 'green' | 'rust' | 'red' | 'neutral' };
    paymentDue?: string;
    showPayment: boolean;
    amountPrimary?: string;
    amountHome?: string;
  };
  flightRows: Array<{ label: string; value: string }>;
} {
  const { canSeeFinancials, hasConfirmationDoc, convertToHomeCurrency, homeCurrency } = options;
  const depDate = entry.dateStart || calendarDate;
  const arrDate = entry.arrivalDate || depDate;
  const depYmd = depDate.slice(0, 10);
  const arrYmd = arrDate.slice(0, 10);
  const dayOffset =
    arrYmd > depYmd
      ? Math.round(
          (new Date(`${arrYmd}T12:00:00`).getTime() - new Date(`${depYmd}T12:00:00`).getTime()) / 86400000
        )
      : 0;
  const booked = effectiveBookingStatus(entry, { hasConfirmationDoc });
  const showPayment = canSeeFinancials && entry.paymentStatus !== 'Free';
  const amountPrimary =
    showPayment && entry.amount > 0
      ? formatCurrency(entry.amount, entry.currency || homeCurrency || 'NZD')
      : undefined;
  const amountHome =
    showPayment && convertToHomeCurrency && entry.currency && homeCurrency && entry.amount > 0
      ? formatCurrency(convertToHomeCurrency(entry.amount, entry.currency), homeCurrency)
      : undefined;

  const { from, to } = resolveTransportFromTo(entry);
  const hints = extractFlightNoteHints(entry.notes);
  const depSub = (entry.streetAddress || '').trim() || hints.terminal || undefined;
  const checkInCloses = entry.checkInClosesTime
    ? `${ymdLong(depDate)}, ${formatTimeHHMM(entry.checkInClosesTime)}`
    : '—';
  const bagCheck = entry.bagCheckClosesTime
    ? `${ymdLong(depDate)}, ${formatTimeHHMM(entry.bagCheckClosesTime)}`
    : '—';
  const baggage = (entry.baggageAllowance || '').trim() || hints.baggage || '—';
  const transfers = entry.transportTransfers;
  const stopLabel =
    transfers === 0 || transfers === undefined
      ? 'Non-stop'
      : transfers === 1
        ? '1 stop'
        : `${transfers} stops`;
  const ticketing = (entry.supplier || '').trim();
  const operating = (entry.operatingAirline || '').trim() || ticketing;

  return {
    title: entry.title || `Fly ${from !== '—' ? from : ''} to ${to !== '—' ? to : ''}`.trim() || 'Flight',
    departs: {
      time: formatTimeHHMM(entry.timeStart) || '—',
      date: ymdLong(depDate),
      location: from,
      sub: depSub
    },
    arrives: {
      time: formatTimeHHMM(entry.arrivalTime ?? '') || '—',
      date: ymdLong(arrDate),
      location: to,
      dayOffset: dayOffset > 0 ? dayOffset : undefined
    },
    duration: (entry.duration || '').trim() || '—',
    stopLabel,
    ticketingAirline: ticketing || '—',
    operatingAirline: operating || '—',
    bookingPayment: {
      bookingReference: (entry.bookingReference || '').trim() || '—',
      bookingStatus: {
        label: booked ? 'Booked' : entry.bookingStatus,
        tone: bookingPillTone(booked ? 'Booked' : entry.bookingStatus)
      },
      paymentStatus: showPayment
        ? { label: entry.paymentStatus, tone: paymentPillTone(entry.paymentStatus) }
        : undefined,
      paymentDue: showPayment ? paymentDueReadLabel(entry) : undefined,
      showPayment,
      amountPrimary,
      amountHome
    },
    flightRows: [
      { label: 'Flight number', value: (entry.flightNumbers || '').trim() || '—' },
      { label: 'Cabin class', value: formatDisplayLabel(entry.cabinClass) || '—' },
      { label: 'Check-in closes', value: checkInCloses },
      { label: 'Bag check closes', value: bagCheck },
      { label: 'From', value: from },
      { label: 'To', value: to },
      { label: 'Baggage allowance', value: baggage }
    ]
  };
}

export function findFlightBoardingPassHref(docs: EntryDocument[]): string | undefined {
  for (const d of docs) {
    if (d.fileUrl) return d.fileUrl;
  }
  return undefined;
}

export function findFlightAirlineHref(links: EntryLink[]): string | undefined {
  return links[0]?.url;
}
