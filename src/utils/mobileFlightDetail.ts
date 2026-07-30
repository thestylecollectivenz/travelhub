import type { ItineraryEntry } from '../models/ItineraryEntry';
import type { EntryDocument } from '../models/EntryDocument';
import type { EntryLink } from '../models/EntryLink';
import { formatCurrency } from './financialUtils';
import { paymentDueActionLabel } from './paymentDueLabels';
import { formatDisplayLabel } from './mobileDisplayFormat';
import { effectiveBookingStatus } from './bookingStatusUtils';
import { formatTimeHHMM } from './itineraryTimeUtils';

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
  operatingAirline?: string;
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
  const dayOffset = arrYmd > depYmd ? Math.round((new Date(`${arrYmd}T12:00:00`).getTime() - new Date(`${depYmd}T12:00:00`).getTime()) / 86400000) : 0;
  const booked = effectiveBookingStatus(entry, { hasConfirmationDoc });
  const showPayment = canSeeFinancials && entry.paymentStatus !== 'Free' && entry.amount > 0;
  const amountPrimary =
    showPayment && entry.amount > 0
      ? formatCurrency(entry.amount, entry.currency || homeCurrency || 'NZD')
      : undefined;
  const amountHome =
    showPayment && convertToHomeCurrency && entry.currency && homeCurrency
      ? formatCurrency(convertToHomeCurrency(entry.amount, entry.currency), homeCurrency)
      : undefined;

  return {
    title: entry.title || `Flight ${entry.transportFrom || ''} to ${entry.transportTo || ''}`.trim(),
    departs: {
      time: formatTimeHHMM(entry.timeStart) || '—',
      date: ymdLong(depDate),
      location: entry.transportFrom || entry.location || '—',
      sub: entry.streetAddress || undefined
    },
    arrives: {
      time: formatTimeHHMM(entry.arrivalTime ?? '') || '—',
      date: ymdLong(arrDate),
      location: entry.transportTo || '—',
      dayOffset: dayOffset > 0 ? dayOffset : undefined
    },
    duration: (entry.duration || '').trim() || '—',
    stopLabel: 'Non-stop',
    ticketingAirline: (entry.supplier || '').trim() || '—',
    operatingAirline: (entry.operatingAirline || '').trim() || undefined,
    bookingPayment: {
      bookingReference: entry.bookingReference || entry.flightNumbers || '—',
      bookingStatus: { label: booked ? 'Booked' : entry.bookingStatus, tone: bookingPillTone(booked ? 'Booked' : entry.bookingStatus) },
      paymentStatus: showPayment
        ? { label: entry.paymentStatus, tone: paymentPillTone(entry.paymentStatus) }
        : undefined,
      paymentDue: showPayment ? paymentDueActionLabel(entry) : undefined,
      showPayment,
      amountPrimary,
      amountHome
    },
    flightRows: [
      { label: 'Flight number', value: entry.flightNumbers || '—' },
      { label: 'Cabin class', value: formatDisplayLabel(entry.cabinClass) || '—' },
      { label: 'Check-in opens', value: entry.checkInClosesTime ? `${ymdLong(depDate)} ${formatTimeHHMM(entry.checkInClosesTime)}` : '—' },
      { label: 'Route', value: `${entry.transportFrom || '—'} → ${entry.transportTo || '—'}` },
      { label: 'Baggage allowance', value: entry.notes ? '' : '—' }
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
