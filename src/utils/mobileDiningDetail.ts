import type { ItineraryEntry } from '../models/ItineraryEntry';
import type { EntryDocument } from '../models/EntryDocument';
import type { EntryLink } from '../models/EntryLink';
import { formatCurrency } from './financialUtils';
import { formatTimeHHMM } from './itineraryTimeUtils';
import { effectiveBookingStatus } from './bookingStatusUtils';
import { formatDisplayLabel } from './mobileDisplayFormat';

export interface DiningGridCell {
  label: string;
  value: string;
  pill?: { label: string; tone: 'green' | 'rust' | 'red' | 'neutral' };
}

export interface DiningSummaryCell {
  label: string;
  value: string;
  icon: 'time' | 'duration' | 'supplier' | 'payment';
  highlight?: boolean;
}

export interface DiningDocLinkItem {
  id: string;
  label: string;
  href: string;
  kind: 'document' | 'link';
}

function paymentPillTone(status: string): 'green' | 'rust' | 'red' | 'neutral' {
  if (status === 'Fully paid' || status === 'Free') return 'green';
  if (status === 'Part paid') return 'neutral';
  return 'rust';
}

function formatMealType(value?: string): string {
  return value?.trim() || '—';
}

export function isDiningOnCruiseItinerary(
  calendarDate: string,
  allEntries: ItineraryEntry[]
): boolean {
  const ymd = calendarDate.slice(0, 10);
  if (!ymd) return false;
  return allEntries.some((e) => {
    if (e.category !== 'Cruise') return false;
    const start = (e.embarksDate || e.dateStart || '').slice(0, 10);
    const end = (e.disembarksDate || e.dateEnd || '').slice(0, 10);
    if (!start || !end) return false;
    return ymd >= start && ymd <= end;
  });
}

export function findDiningBookingUrl(links: EntryLink[]): string | undefined {
  for (const l of links) {
    const name = `${l.linkTitle || ''} ${l.title || ''} ${l.url}`.toLowerCase();
    if (/book|reserve|reservation|opentable|resy|sevenrooms|website|dining/i.test(name)) return l.url;
  }
  return links.find((l) => /^https?:/i.test(l.url))?.url;
}

export function findDiningMenuLink(links: EntryLink[], documents: EntryDocument[]): string | undefined {
  for (const l of links) {
    const name = `${l.linkTitle || ''} ${l.title || ''} ${l.url}`.toLowerCase();
    if (/menu|dining/.test(name)) return l.url;
  }
  for (const d of documents) {
    const name = `${d.title || ''} ${d.fileName || ''}`.toLowerCase();
    if (/menu/.test(name)) return d.fileUrl;
  }
  return links[0]?.url || documents.find((d) => !/confirm|invoice/i.test(`${d.title} ${d.fileName}`))?.fileUrl;
}

export function buildDiningDocLinkItems(docs: EntryDocument[], links: EntryLink[]): DiningDocLinkItem[] {
  const items: DiningDocLinkItem[] = [];
  for (const d of docs) {
    const label = d.title || d.fileName || 'Document';
    items.push({ id: `doc-${d.id}`, label, href: d.fileUrl, kind: 'document' });
  }
  for (const l of links) {
    const title = l.linkTitle || l.title || l.url;
    const isWebsite = /website|dining|information|http/i.test(title);
    items.push({
      id: `link-${l.id}`,
      label: isWebsite ? 'Dining information' : title,
      href: l.url,
      kind: 'link'
    });
  }
  return items;
}

export function buildDiningDetailData(
  entry: ItineraryEntry,
  options: { canSeeFinancials: boolean; hasConfirmationDoc: boolean; calendarDate: string; allEntries: ItineraryEntry[] }
): {
  summary: DiningSummaryCell[];
  bookingRow1: DiningGridCell[];
  bookingRow2: DiningGridCell[];
  diningRow1: DiningGridCell[];
  onCruiseItinerary: boolean;
} {
  const { canSeeFinancials, hasConfirmationDoc, calendarDate, allEntries } = options;
  const booked = effectiveBookingStatus(entry, { hasConfirmationDoc });

  const summary: DiningSummaryCell[] = [
    { label: 'Reservation time', value: entry.timeStart ? formatTimeHHMM(entry.timeStart) : '—', icon: 'time' },
    { label: 'Duration', value: entry.duration?.trim() || '—', icon: 'duration' },
    { label: 'Supplier', value: entry.supplier?.trim() || '—', icon: 'supplier' }
  ];

  if (canSeeFinancials) {
    summary.push({
      label: 'Payment status',
      value: formatDisplayLabel(entry.paymentStatus),
      icon: 'payment',
      highlight: entry.paymentStatus === 'Fully paid' || entry.paymentStatus === 'Free'
    });
  }

  const bookingRow1: DiningGridCell[] = [];
  const bookingRow2: DiningGridCell[] = [];

  if (canSeeFinancials && entry.amount > 0) {
    bookingRow1.push({
      label: 'Amount',
      value: formatCurrency(entry.amount, entry.currency)
    });
    bookingRow1.push({
      label: 'Amount type',
      value: entry.costCertainty ? formatDisplayLabel(entry.costCertainty) : '—'
    });
  }
  bookingRow1.push({
    label: 'Booking required',
    value: entry.bookingRequired ? 'Yes' : 'No'
  });

  bookingRow2.push({
    label: 'Booking status',
    value: '',
    pill: { label: formatDisplayLabel(booked), tone: booked === 'Booked' ? 'green' : 'rust' }
  });
  if (canSeeFinancials) {
    bookingRow2.push({
      label: 'Payment status',
      value: '',
      pill: { label: formatDisplayLabel(entry.paymentStatus), tone: paymentPillTone(entry.paymentStatus) }
    });
  }

  const diningRow1: DiningGridCell[] = [
    { label: 'Supplier / operator', value: entry.supplier?.trim() || '—' },
    { label: 'Category', value: entry.category || '—' },
    { label: 'Meal type', value: formatMealType(entry.mealType) }
  ];

  return {
    summary,
    bookingRow1,
    bookingRow2,
    diningRow1,
    onCruiseItinerary: isDiningOnCruiseItinerary(calendarDate, allEntries)
  };
}
