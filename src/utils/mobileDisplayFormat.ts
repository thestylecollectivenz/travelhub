import type { CabinClass, TransportJourneyType } from '../models/ItineraryEntry';

const LABEL_MAP: Record<string, string> = {
  oneway: 'One way',
  return: 'Return',
  economy: 'Economy',
  premium_economy: 'Premium economy',
  business: 'Business',
  Idea: 'Idea',
  Planned: 'Planned',
  Confirmed: 'Confirmed',
  'Not booked': 'Not booked',
  Booked: 'Booked',
  'Not paid': 'Not paid',
  'Part paid': 'Part paid',
  'Fully paid': 'Fully paid',
  Free: 'Free',
  Estimated: 'Estimated',
  Confirmed_cost: 'Confirmed'
};

export function formatDisplayLabel(raw?: string | null): string {
  const s = String(raw ?? '').trim();
  if (!s) return '';
  if (LABEL_MAP[s]) return LABEL_MAP[s];
  if (s === 'PerPerson') return 'Per person';
  if (s === 'PerNight') return 'Per night';
  if (s === 'PerDay') return 'Per day';
  if (/^[a-z]/.test(s) && !s.includes(' ')) {
    return s.charAt(0).toUpperCase() + s.slice(1);
  }
  return s;
}

export function formatJourneyType(value?: TransportJourneyType | string): string {
  if (value === 'oneway') return 'One way';
  if (value === 'return') return 'Return';
  return formatDisplayLabel(value);
}

export function formatCabinClass(value?: CabinClass | string): string {
  return formatDisplayLabel(value);
}

const ARROW_SPLIT = /\s*(?:→|->)\s*/;

function flipArrowTitle(title: string): string {
  const parts = title.split(ARROW_SPLIT);
  if (parts.length !== 2) return title;
  const left = parts[0].trim();
  const rightPart = parts[1].trim();
  if (!left || !rightPart) return title;
  const modeMatch = rightPart.match(/^(.+?)(\s*\([^)]+\))$/);
  if (modeMatch) {
    return `${modeMatch[1].trim()} → ${left}${modeMatch[2]}`;
  }
  return `${rightPart} → ${left}`;
}

/** True only on the return calendar day (or when explicitly marked return leg). */
export function isReturnTransportLeg(entry: {
  category: string;
  journeyType?: TransportJourneyType;
  dateStart?: string;
  returnDate?: string;
  calendarDate: string;
}): boolean {
  if (entry.category !== 'Transport') return false;
  if (entry.journeyType !== 'return') return false;
  const day = (entry.calendarDate || '').slice(0, 10);
  const ret = (entry.returnDate || '').slice(0, 10);
  const out = (entry.dateStart || '').slice(0, 10);
  // Return-leg day: viewing the return date (and it differs from outbound when both set).
  if (ret && day && ret === day) return true;
  // Fallback when returnDate missing: never treat every day as return.
  if (!ret && !out) return false;
  return false;
}

export function transportDisplayTitle(
  entry: {
    title: string;
    transportFrom?: string;
    transportTo?: string;
    transportMode?: string;
    journeyType?: TransportJourneyType;
    dateStart?: string;
    returnDate?: string;
  },
  calendarDate: string
): string {
  const from = (entry.transportFrom || '').trim();
  const to = (entry.transportTo || '').trim();
  const mode = (entry.transportMode || '').trim();
  const suffix = mode ? ` (${mode})` : '';
  const isReturn = isReturnTransportLeg({ ...entry, category: 'Transport', calendarDate });
  if (from && to) {
    return isReturn ? `${to} → ${from}${suffix}` : `${from} → ${to}${suffix}`;
  }
  const raw = (entry.title || '').trim();
  if (!raw) return 'Transport';
  return isReturn ? flipArrowTitle(raw) : raw;
}
