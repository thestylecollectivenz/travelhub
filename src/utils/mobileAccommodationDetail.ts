import type { ItineraryEntry } from '../models/ItineraryEntry';
import type { EntryDocument } from '../models/EntryDocument';
import type { EntryLink } from '../models/EntryLink';
import { formatCurrency } from './financialUtils';
import {
  formatTimeHHMM,
  effectiveAccommodationArrivalTime,
  effectiveAccommodationDepartureTime
} from './itineraryTimeUtils';
import { effectiveBookingStatus } from './bookingStatusUtils';
import { formatDisplayLabel } from './mobileDisplayFormat';

export interface AccomGridCell {
  label: string;
  value: string;
  subValue?: string;
  pill?: { label: string; tone: 'green' | 'rust' | 'red' | 'neutral' };
}

export interface AccomDocLinkPill {
  id: string;
  label: string;
  href: string;
  kind: 'document' | 'link';
}

export interface AccomPaymentAmountBlock {
  primary: string;
  primaryPerNight?: string;
  homeApprox?: string;
  homePerNight?: string;
  exchangeNote?: string;
}

export interface AccomBookingPaymentModel {
  bookingReference?: string;
  bookingStatus: { label: string; tone: 'green' | 'rust' | 'red' | 'neutral' };
  checkInPrimary?: string;
  checkInSub?: string;
  checkOutPrimary?: string;
  lengthOfStay?: string;
  supplier?: string;
  paymentDue?: string;
  paymentStatus?: { label: string; tone: 'green' | 'rust' | 'red' | 'neutral' };
  amount?: AccomPaymentAmountBlock;
  showPayment: boolean;
}

function ymd(value?: string): string {
  if (!value) return '';
  const d = new Date(`${value.slice(0, 10)}T00:00:00.000Z`);
  if (Number.isNaN(d.getTime())) return value.slice(0, 10);
  return d.toLocaleDateString('en-NZ', { day: 'numeric', month: 'short', year: 'numeric' });
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
  return 'neutral';
}

function cell(label: string, value?: string, pill?: AccomGridCell['pill']): AccomGridCell | undefined {
  const text = (value ?? '').trim();
  if (!text && !pill) return undefined;
  return { label, value: text, pill };
}

function boolYesNo(value?: boolean): string {
  return value === true ? 'Yes' : 'No';
}

function checkInParts(entry: ItineraryEntry): { primary?: string; sub?: string } {
  const dateLabel = ymd(entry.dateStart);
  if (!dateLabel) return {};
  const planned = formatTimeHHMM(effectiveAccommodationArrivalTime(entry));
  const contractual = entry.checkInTime?.trim() ? formatTimeHHMM(entry.checkInTime) : '';
  const time = planned || contractual;
  if (!time) return { primary: dateLabel };
  const primary = `${dateLabel} ${time}`;
  const sub =
    planned && contractual && planned !== contractual ? `(from ${contractual})` : undefined;
  return { primary, sub };
}

function checkOutPrimary(entry: ItineraryEntry): string | undefined {
  const dateLabel = ymd(entry.dateEnd);
  if (!dateLabel) return undefined;
  const planned = formatTimeHHMM(effectiveAccommodationDepartureTime(entry));
  const contractual = entry.checkOutTime?.trim() ? formatTimeHHMM(entry.checkOutTime) : '';
  const time = planned || contractual;
  return time ? `${dateLabel} ${time}` : dateLabel;
}

export function buildAccommodationDocLinkPills(docs: EntryDocument[], links: EntryLink[]): AccomDocLinkPill[] {
  const pills: AccomDocLinkPill[] = [];
  for (const d of docs) {
    const name = `${d.title || ''} ${d.fileName || ''}`.toLowerCase();
    let label = d.title || d.fileName || 'Document';
    if (/voucher|confirm/.test(name)) label = label.toLowerCase().includes('pdf') ? label : `${label} PDF`;
    else if (/invoice/.test(name)) label = label.toLowerCase().includes('pdf') ? label : `${label} PDF`;
    else if (!/\.pdf/i.test(label)) label = `${label} PDF`;
    pills.push({ id: `doc-${d.id}`, label, href: d.fileUrl, kind: 'document' });
  }
  for (const l of links) {
    const title = l.linkTitle || l.title || l.url;
    const isWebsite = /website|hotel|booking|http/i.test(title) || /hotel|booking\.com|expedia/i.test(l.url);
    pills.push({
      id: `link-${l.id}`,
      label: isWebsite ? 'Hotel website' : title,
      href: l.url,
      kind: 'link'
    });
  }
  return pills;
}

export function buildAccommodationDetailData(
  entry: ItineraryEntry,
  options: {
    canSeeFinancials: boolean;
    hasConfirmationDoc: boolean;
    convertToHomeCurrency?: (amount: number, currency: string) => number;
    homeCurrency?: string;
  }
): {
  nights: number;
  checkInDate: string;
  checkInTime: string;
  checkOutDate: string;
  checkOutTime: string;
  checkInPrimary?: string;
  checkInSub?: string;
  checkOutPrimary?: string;
  bookingPayment: AccomBookingPaymentModel;
  stayGrid: AccomGridCell[];
  perks?: string;
  cancellation?: string;
} {
  const { canSeeFinancials, hasConfirmationDoc, convertToHomeCurrency, homeCurrency } = options;
  const booked = effectiveBookingStatus(entry, { hasConfirmationDoc });
  const nights = nightsBetween(entry.dateStart, entry.dateEnd);
  const cin = checkInParts(entry);
  const cout = checkOutPrimary(entry);
  const currency = (entry.currency || 'NZD').toUpperCase();
  const home = (homeCurrency || 'NZD').toUpperCase();

  let amountBlock: AccomPaymentAmountBlock | undefined;
  if (canSeeFinancials && entry.amount > 0) {
    const primary = `${formatCurrency(entry.amount, currency)} ${currency}`;
    const perNight = nights > 0 ? `${formatCurrency(entry.amount / nights, currency)} ${currency} per night` : undefined;
    let homeApprox: string | undefined;
    let homePerNight: string | undefined;
    let exchangeNote: string | undefined;
    if (convertToHomeCurrency && currency !== home) {
      const homeTotal = convertToHomeCurrency(entry.amount, currency);
      if (Number.isFinite(homeTotal)) {
        homeApprox = `≈ ${formatCurrency(homeTotal, home)} ${home}`;
        if (nights > 0) {
          homePerNight = `≈ ${formatCurrency(homeTotal / nights, home)} ${home} per night`;
        }
        const rate = entry.amount !== 0 ? homeTotal / entry.amount : 0;
        if (rate > 0) {
          const today = new Date().toLocaleDateString('en-NZ', {
            day: 'numeric',
            month: 'short',
            year: 'numeric'
          });
          exchangeNote = `Exchange rate: 1 ${currency} = ${rate.toFixed(4)} ${home} (${today})`;
        }
      }
    }
    amountBlock = { primary, primaryPerNight: perNight, homeApprox, homePerNight, exchangeNote };
  }

  const bookingPayment: AccomBookingPaymentModel = {
    bookingReference: (entry.bookingReference || '').trim() || undefined,
    bookingStatus: {
      label: formatDisplayLabel(booked),
      tone: bookingPillTone(booked)
    },
    checkInPrimary: cin.primary,
    checkInSub: cin.sub,
    checkOutPrimary: cout,
    lengthOfStay: nights > 0 ? `${nights} night${nights === 1 ? '' : 's'}` : undefined,
    supplier: (entry.supplier || '').trim() || undefined,
    paymentDue: entry.paymentDueDate
      ? ymd(entry.paymentDueDate)
      : entry.bookingDueDate
        ? ymd(entry.bookingDueDate)
        : undefined,
    paymentStatus: canSeeFinancials
      ? {
          label: formatDisplayLabel(entry.paymentStatus),
          tone: paymentPillTone(entry.paymentStatus)
        }
      : undefined,
    amount: amountBlock,
    showPayment: canSeeFinancials
  };

  const stayGrid: Array<AccomGridCell | undefined> = [
    cell('Room type', entry.roomType || '—'),
    { label: 'Breakfast included', value: boolYesNo(entry.breakfastIncluded) },
    { label: 'Parking included', value: boolYesNo(entry.parkingIncluded) }
  ];

  const arriveDetail = cin.primary
    ? `Arrive ${cin.primary}${cin.sub ? ` ${cin.sub}` : ''}`
    : '';
  const departDetail = cout ? `Depart ${cout}` : '';

  return {
    nights,
    checkInDate: ymd(entry.dateStart),
    checkInTime: arriveDetail,
    checkOutDate: ymd(entry.dateEnd),
    checkOutTime: departDetail,
    checkInPrimary: cin.primary,
    checkInSub: cin.sub,
    checkOutPrimary: cout,
    bookingPayment,
    stayGrid: stayGrid.filter((c): c is AccomGridCell => Boolean(c)),
    perks: (entry.perksIncluded || '').trim() || undefined,
    cancellation: (entry.cancellationPolicy || '').trim() || undefined
  };
}
