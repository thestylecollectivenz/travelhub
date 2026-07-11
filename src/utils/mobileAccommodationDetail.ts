import type { ItineraryEntry } from '../models/ItineraryEntry';
import type { EntryDocument } from '../models/EntryDocument';
import type { EntryLink } from '../models/EntryLink';
import { formatCurrency } from './financialUtils';
import { formatTimeHHMM } from './itineraryTimeUtils';
import { effectiveBookingStatus } from './bookingStatusUtils';
import { formatDisplayLabel } from './mobileDisplayFormat';

export interface AccomGridCell {
  label: string;
  value: string;
  pill?: { label: string; tone: 'green' | 'rust' | 'red' | 'neutral' };
}

export interface AccomDocLinkPill {
  id: string;
  label: string;
  href: string;
  kind: 'document' | 'link';
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

function cell(label: string, value?: string, pill?: AccomGridCell['pill']): AccomGridCell | undefined {
  const text = (value ?? '').trim();
  if (!text && !pill) return undefined;
  return { label, value: text, pill };
}

function boolYesNo(value?: boolean): string {
  return value === true ? 'Yes' : 'No';
}

function unitPricingLabel(entry: ItineraryEntry): string | undefined {
  if (!entry.unitType || !entry.unitAmount) return undefined;
  const unit = entry.unitType.replace('per ', '').replace('Per', 'per ');
  return `${formatCurrency(entry.unitAmount, entry.currency)} per ${unit.toLowerCase()}`;
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
  options: { canSeeFinancials: boolean; hasConfirmationDoc: boolean }
): {
  nights: number;
  checkInDate: string;
  checkInTime: string;
  checkOutDate: string;
  checkOutTime: string;
  bookingGrid: AccomGridCell[];
  extraBookingGrid: AccomGridCell[];
  stayGrid: AccomGridCell[];
  perks?: string;
  cancellation?: string;
} {
  const { canSeeFinancials, hasConfirmationDoc } = options;
  const booked = effectiveBookingStatus(entry, { hasConfirmationDoc });
  const nights = nightsBetween(entry.dateStart, entry.dateEnd);

  const bookingGrid: Array<AccomGridCell | undefined> = [
    cell('Booking reference', entry.bookingReference),
    cell(
      'Payment due',
      entry.paymentDueDate ? ymd(entry.paymentDueDate) : ymd(entry.bookingDueDate) || undefined
    ),
    canSeeFinancials && entry.amount > 0
      ? cell(
          'Amount',
          `${formatCurrency(entry.amount, entry.currency)}${entry.costCertainty ? ` (${formatDisplayLabel(entry.costCertainty)})` : ''}`
        )
      : undefined,
    canSeeFinancials ? cell('Unit pricing', unitPricingLabel(entry)) : undefined,
    canSeeFinancials
      ? cell('Payment status', '', { label: formatDisplayLabel(entry.paymentStatus), tone: paymentPillTone(entry.paymentStatus) })
      : undefined,
    cell('Supplier', entry.supplier)
  ];

  const extraBookingGrid: Array<AccomGridCell | undefined> = [
    booked !== 'Booked' ? cell('Booking required', entry.bookingRequired ? 'Yes' : 'No') : undefined,
    cell('Booking status', formatDisplayLabel(booked)),
    canSeeFinancials && entry.amountPaid
      ? cell('Amount paid', formatCurrency(entry.amountPaid, entry.paymentCurrency || entry.currency))
      : undefined
  ];

  const stayGrid: Array<AccomGridCell | undefined> = [
    cell('Room type', entry.roomType || '—'),
    { label: 'Breakfast included', value: boolYesNo(entry.breakfastIncluded) },
    { label: 'Parking included', value: boolYesNo(entry.parkingIncluded) }
  ];

  return {
    nights,
    checkInDate: ymd(entry.dateStart),
    checkInTime: entry.checkInTime ? formatTimeHHMM(entry.checkInTime) : '',
    checkOutDate: ymd(entry.dateEnd),
    checkOutTime: entry.checkOutTime ? formatTimeHHMM(entry.checkOutTime) : '',
    bookingGrid: bookingGrid.filter((c): c is AccomGridCell => Boolean(c)),
    extraBookingGrid: extraBookingGrid.filter((c): c is AccomGridCell => Boolean(c)),
    stayGrid: stayGrid.filter((c): c is AccomGridCell => Boolean(c)),
    perks: (entry.perksIncluded || '').trim() || undefined,
    cancellation: (entry.cancellationPolicy || '').trim() || undefined
  };
}
