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
  /** Hotel contractual check-in time only (HH:MM). */
  checkInPrimary?: string;
  checkInSub?: string;
  /** Hotel contractual check-out time only (HH:MM). */
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

/** Summary strip: date + planned arrival/departure (falls back to hotel check-in/out times). */
function staySummaryParts(entry: ItineraryEntry): {
  checkInPrimary?: string;
  checkInSub?: string;
  checkOutPrimary?: string;
} {
  const inDate = ymd(entry.dateStart);
  const outDate = ymd(entry.dateEnd);
  const plannedIn = formatTimeHHMM(entry.plannedArrivalTime ?? '');
  const plannedOut = formatTimeHHMM(entry.plannedDepartureTime ?? '');
  const hotelIn = formatTimeHHMM(entry.checkInTime ?? '');
  const hotelOut = formatTimeHHMM(entry.checkOutTime ?? '');

  const arriveTime = plannedIn || hotelIn || formatTimeHHMM(effectiveAccommodationArrivalTime(entry));
  const departTime = plannedOut || hotelOut || formatTimeHHMM(effectiveAccommodationDepartureTime(entry));

  let checkInPrimary: string | undefined;
  let checkInSub: string | undefined;
  if (inDate) {
    checkInPrimary = arriveTime ? `${inDate} ${arriveTime}` : inDate;
    if (plannedIn && hotelIn && plannedIn !== hotelIn) {
      checkInSub = `(from ${hotelIn})`;
    }
  }

  let checkOutPrimary: string | undefined;
  if (outDate) {
    checkOutPrimary = departTime ? `${outDate} ${departTime}` : outDate;
  }

  return { checkInPrimary, checkInSub, checkOutPrimary };
}

/** Booking & payment: hotel check-in / check-out times only. */
function hotelCheckTimes(entry: ItineraryEntry): { checkIn?: string; checkOut?: string } {
  const checkIn = formatTimeHHMM(entry.checkInTime ?? '') || undefined;
  const checkOut = formatTimeHHMM(entry.checkOutTime ?? '') || undefined;
  return { checkIn, checkOut };
}

function isRawUrlLabel(value: string): boolean {
  const t = value.trim();
  return !t || /^https?:\/\//i.test(t) || /^www\./i.test(t);
}

/** Friendly document label — keep the real name; only tidy common confirmation/package cases. */
function accommodationDocLabel(doc: EntryDocument): string {
  const raw = (doc.title || doc.fileName || 'Document').trim() || 'Document';
  const name = `${doc.title || ''} ${doc.fileName || ''}`.toLowerCase();
  if (/confirm/.test(name) && !/package|voucher|invoice/.test(name)) {
    return /confirm/i.test(raw) ? raw.replace(/\s*PDF$/i, '').trim() || 'Confirmation' : 'Confirmation';
  }
  if (/package/.test(name)) {
    return raw.replace(/\s*PDF$/i, '').trim() || 'Package details';
  }
  return raw;
}

/**
 * Link label: always prefer the user's title.
 * Only use "Hotel website" when the title is blank/a raw URL and the link looks like the property site —
 * never rename every link that happens to contain "hotel" in the URL (that duplicated pills).
 */
function accommodationLinkLabel(link: EntryLink, hotelWebsiteAlreadyUsed: boolean): string {
  const title = (link.linkTitle || link.title || '').trim();
  if (title && !isRawUrlLabel(title)) {
    // User already named it — keep it (e.g. Package details, Booking.com)
    if (/^hotel\s*website$/i.test(title)) return hotelWebsiteAlreadyUsed ? title : 'Hotel website';
    return title;
  }
  const url = (link.url || '').toLowerCase();
  const titledWebsite = /hotel\s*website|^website$/i.test(title);
  const looksLikePropertySite =
    titledWebsite ||
    /booking\.com|expedia\.|hotels\.com|marriott\.|hilton\.|ihg\.|millenniumhotels|accor|hyatt/i.test(url);
  if (looksLikePropertySite && !hotelWebsiteAlreadyUsed) return 'Hotel website';
  if (title) return title;
  try {
    return new URL(link.url).hostname.replace(/^www\./i, '') || 'Link';
  } catch {
    return 'Link';
  }
}

export function buildAccommodationDocLinkPills(docs: EntryDocument[], links: EntryLink[]): AccomDocLinkPill[] {
  const pills: AccomDocLinkPill[] = [];
  const seenHrefs = new Set<string>();

  const normHref = (href: string): string => {
    try {
      const u = new URL(href);
      u.hash = '';
      return u.toString().replace(/\/$/, '').toLowerCase();
    } catch {
      return (href || '').trim().toLowerCase();
    }
  };

  for (const d of docs) {
    const href = (d.fileUrl || '').trim();
    if (!href) continue;
    const key = normHref(href);
    if (key && seenHrefs.has(key)) continue;
    if (key) seenHrefs.add(key);
    pills.push({
      id: `doc-${d.id}`,
      label: accommodationDocLabel(d),
      href,
      kind: 'document'
    });
  }

  let hotelWebsiteUsed = false;
  for (const l of links) {
    const href = (l.url || '').trim();
    if (!href) continue;
    const key = normHref(href);
    if (key && seenHrefs.has(key)) continue;
    if (key) seenHrefs.add(key);
    const label = accommodationLinkLabel(l, hotelWebsiteUsed);
    if (/^hotel website$/i.test(label)) hotelWebsiteUsed = true;
    pills.push({
      id: `link-${l.id}`,
      label,
      href,
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
  const summary = staySummaryParts(entry);
  const hotelTimes = hotelCheckTimes(entry);
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
    checkInPrimary: hotelTimes.checkIn,
    checkInSub: undefined,
    checkOutPrimary: hotelTimes.checkOut,
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

  const arriveDetail = summary.checkInPrimary
    ? `Arrive ${summary.checkInPrimary}${summary.checkInSub ? ` ${summary.checkInSub}` : ''}`
    : '';
  const departDetail = summary.checkOutPrimary ? `Depart ${summary.checkOutPrimary}` : '';

  return {
    nights,
    checkInDate: ymd(entry.dateStart),
    checkInTime: arriveDetail,
    checkOutDate: ymd(entry.dateEnd),
    checkOutTime: departDetail,
    checkInPrimary: summary.checkInPrimary,
    checkInSub: summary.checkInSub,
    checkOutPrimary: summary.checkOutPrimary,
    bookingPayment,
    stayGrid: stayGrid.filter((c): c is AccomGridCell => Boolean(c)),
    perks: (entry.perksIncluded || '').trim() || undefined,
    cancellation: (entry.cancellationPolicy || '').trim() || undefined
  };
}
