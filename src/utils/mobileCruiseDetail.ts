import type { ItineraryEntry } from '../models/ItineraryEntry';
import type { EntryLink } from '../models/EntryLink';
import { formatCurrency } from './financialUtils';
import { paymentDueActionLabel } from './paymentDueLabels';
import { formatDisplayLabel } from './mobileDisplayFormat';

export interface CruiseOverviewCell {
  label: string;
  value: string;
  icon: 'line' | 'ship' | 'cabin' | 'embark' | 'disembark' | 'payment';
  highlight?: boolean;
  pillTone?: 'green' | 'rust' | 'red' | 'neutral';
}

export interface CruiseBookingRow {
  label: string;
  value: string;
  highlight?: boolean;
}

function ymd(value?: string): string {
  if (!value) return '';
  const d = new Date(`${value.slice(0, 10)}T00:00:00.000Z`);
  if (Number.isNaN(d.getTime())) return value.slice(0, 10);
  return d.toLocaleDateString('en-NZ', { day: 'numeric', month: 'short', year: 'numeric' });
}

function paymentPillTone(status: string): 'green' | 'rust' | 'red' | 'neutral' {
  if (status === 'Fully paid' || status === 'Free') return 'green';
  if (status === 'Part paid') return 'neutral';
  return 'rust';
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
  options: { canSeeFinancials: boolean }
): {
  overview: CruiseOverviewCell[];
  bookingRows: CruiseBookingRow[];
  packageName?: string;
  inclusionItems: string[];
  obcItems: string[];
} {
  const { canSeeFinancials } = options;

  const overview: CruiseOverviewCell[] = [
    { label: 'Cruise line', value: entry.cruiseLineName || '—', icon: 'line' },
    { label: 'Ship', value: entry.shipName || '—', icon: 'ship' },
    { label: 'Cabin', value: entry.cabinTypeAndNumber || '—', icon: 'cabin' },
    { label: 'Embark', value: ymd(entry.embarksDate) || '—', icon: 'embark' },
    { label: 'Disembark', value: ymd(entry.disembarksDate) || '—', icon: 'disembark' }
  ];

  if (canSeeFinancials) {
    overview.push({
      label: 'Payment status',
      value: formatDisplayLabel(entry.paymentStatus),
      icon: 'payment',
      pillTone: paymentPillTone(entry.paymentStatus)
    });
  }

  const bookingRows: CruiseBookingRow[] = [];
  if (entry.cruiseReference) {
    bookingRows.push({ label: 'Cruise reference', value: entry.cruiseReference });
  }
  if (canSeeFinancials && entry.amount > 0) {
    bookingRows.push({
      label: 'Amount',
      value: formatCurrency(entry.amount, entry.currency)
    });
  }
  if (canSeeFinancials && entry.amountPaid) {
    bookingRows.push({
      label: 'Amount paid',
      value: formatCurrency(entry.amountPaid, entry.paymentCurrency || entry.currency)
    });
  }
  if (canSeeFinancials && entry.paymentDueDate) {
    bookingRows.push({
      label: 'Payment due',
      value: `${paymentDueActionLabel(entry)} ${ymd(entry.paymentDueDate)}`,
      highlight: entry.paymentStatus === 'Not paid' || entry.paymentStatus === 'Part paid'
    });
  }

  return {
    overview,
    bookingRows,
    packageName: (entry.packageName || '').trim() || undefined,
    inclusionItems: parseCruiseListItems(entry.packageInclusions),
    obcItems: parseCruiseListItems(entry.onboardCredit)
  };
}
