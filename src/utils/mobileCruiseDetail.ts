import type { ItineraryEntry } from '../models/ItineraryEntry';
import type { EntryLink } from '../models/EntryLink';
import { formatCurrency } from './financialUtils';
import { paymentDueActionLabel } from './paymentDueLabels';
import { formatDisplayLabel } from './mobileDisplayFormat';
import { effectiveBookingStatus } from './bookingStatusUtils';
import { formatTimeHHMM, effectiveCruiseBoardingTime, effectiveCruiseDisembarkTime } from './itineraryTimeUtils';

export interface CruiseOverviewCell {
  label: string;
  value: string;
  icon: 'line' | 'ship' | 'cabin' | 'embark' | 'disembark' | 'nights';
  highlight?: boolean;
  pillTone?: 'green' | 'rust' | 'red' | 'neutral';
}

export interface CruiseGridCell {
  label: string;
  value: string;
}

export interface CruiseBookingPaymentModel {
  cruiseReference: string;
  bookingStatus: { label: string; tone: 'green' | 'rust' | 'red' | 'neutral' };
  embarkPrimary?: string;
  embarkSub?: string;
  disembarkPrimary?: string;
  lengthOfStay: string;
  supplier?: string;
  paymentDue?: string;
  paymentStatus?: { label: string; tone: 'green' | 'rust' | 'red' | 'neutral' };
  amountPrimary?: string;
  amountHome?: string;
  showPayment: boolean;
}

function ymd(value?: string): string {
  if (!value) return '';
  const d = new Date(`${value.slice(0, 10)}T00:00:00.000Z`);
  if (Number.isNaN(d.getTime())) return value.slice(0, 10);
  return d.toLocaleDateString('en-NZ', { day: 'numeric', month: 'short', year: 'numeric' });
}

function cruiseNights(entry: ItineraryEntry): number {
  if (!entry.embarksDate || !entry.disembarksDate) return 0;
  const start = new Date(`${entry.embarksDate.slice(0, 10)}T00:00:00.000Z`);
  const end = new Date(`${entry.disembarksDate.slice(0, 10)}T00:00:00.000Z`);
  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) return 0;
  const diff = Math.floor((end.getTime() - start.getTime()) / 86400000) + 1;
  return diff > 0 ? diff : 0;
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

function splitCabin(cabin?: string): { type: string; number: string } {
  const raw = (cabin || '').trim();
  if (!raw) return { type: '—', number: '—' };
  const hash = raw.match(/^(.+?)\s*[#№]\s*(.+)$/);
  if (hash) return { type: hash[1].trim() || '—', number: hash[2].trim() || '—' };
  const comma = raw.split(/[,·]/).map((s) => s.trim()).filter(Boolean);
  if (comma.length >= 2) return { type: comma[0] || '—', number: comma.slice(1).join(', ') || '—' };
  return { type: raw, number: '—' };
}

function embarkParts(entry: ItineraryEntry): { primary?: string; sub?: string } {
  const dateLabel = ymd(entry.embarksDate);
  if (!dateLabel) return {};
  const time = formatTimeHHMM(effectiveCruiseBoardingTime(entry));
  if (!time) return { primary: dateLabel };
  return { primary: `${dateLabel} ${time}` };
}

function disembarkPrimary(entry: ItineraryEntry): string | undefined {
  const dateLabel = ymd(entry.disembarksDate);
  if (!dateLabel) return undefined;
  const time = formatTimeHHMM(effectiveCruiseDisembarkTime(entry));
  return time ? `${dateLabel} ${time}` : dateLabel;
}

export function parseCruiseListItems(text?: string): string[] {
  if (!text?.trim()) return [];
  return text
    .split(/\r?\n/)
    .map((line) => line.replace(/^[\s•\-*]+/, '').trim())
    .filter(Boolean);
}

export function findCruiseDeckMapLink(links: EntryLink[]): EntryLink | undefined {
  return links.find((l) => /deck/i.test(`${l.linkTitle || ''} ${l.title || ''} ${l.url}`));
}

export function buildCruiseDetailData(
  entry: ItineraryEntry,
  options: {
    canSeeFinancials: boolean;
    hasConfirmationDoc: boolean;
    convertToHomeCurrency?: (amount: number, currency: string) => number;
    homeCurrency?: string;
  }
): {
  overview: CruiseOverviewCell[];
  bookingPayment: CruiseBookingPaymentModel;
  stayGrid: CruiseGridCell[];
  cancellation: string;
  nights: number;
  packageName?: string;
  inclusionItems: string[];
  obcItems: string[];
} {
  const { canSeeFinancials, hasConfirmationDoc, convertToHomeCurrency, homeCurrency } = options;
  const booked = effectiveBookingStatus(entry, { hasConfirmationDoc });
  const nights = cruiseNights(entry);
  const embark = embarkParts(entry);
  const disembark = disembarkPrimary(entry);
  const cabin = splitCabin(entry.cabinTypeAndNumber);
  const currency = (entry.currency || 'NZD').toUpperCase();
  const home = (homeCurrency || 'NZD').toUpperCase();

  const overview: CruiseOverviewCell[] = [
    { label: 'Cruise line', value: entry.cruiseLineName || '—', icon: 'line' },
    { label: 'Ship', value: entry.shipName || '—', icon: 'ship' },
    { label: 'Cabin', value: entry.cabinTypeAndNumber || '—', icon: 'cabin' },
    { label: 'Embark', value: ymd(entry.embarksDate) || '—', icon: 'embark' },
    { label: 'Disembark', value: ymd(entry.disembarksDate) || '—', icon: 'disembark' },
    {
      label: 'Length of stay',
      value: nights > 0 ? `${nights} night${nights === 1 ? '' : 's'}` : '—',
      icon: 'nights'
    }
  ];

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

  const bookingPayment: CruiseBookingPaymentModel = {
    cruiseReference: (entry.cruiseReference || '').trim() || '—',
    bookingStatus: {
      label: formatDisplayLabel(booked),
      tone: bookingPillTone(booked)
    },
    embarkPrimary: embark.primary,
    embarkSub: embark.sub,
    disembarkPrimary: disembark,
    lengthOfStay: nights > 0 ? `${nights} night${nights === 1 ? '' : 's'}` : '—',
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

  const stayGrid: CruiseGridCell[] = [
    { label: 'Cabin type', value: cabin.type },
    { label: 'Cabin number', value: cabin.number }
  ];

  return {
    overview,
    bookingPayment,
    stayGrid,
    cancellation: (entry.cancellationPolicy || '').trim() || '—',
    nights,
    packageName: (entry.packageName || '').trim() || undefined,
    inclusionItems: parseCruiseListItems(entry.packageInclusions),
    obcItems: parseCruiseListItems(entry.onboardCredit)
  };
}
