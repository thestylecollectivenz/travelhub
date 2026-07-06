import type { ItineraryEntry } from '../models/ItineraryEntry';
import type { TransportTimelineLeg } from './itineraryDayEntries';
import { isTransportReturnOnCalendarDate } from './itineraryDayEntries';

const ARROW_SPLIT = /\s*(?:→|->)\s*/;

/** Flip "A → B (Train)" to "B → A (Train)" for return-leg display. */
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

function isReturnLegDisplay(
  entry: ItineraryEntry,
  calendarDate: string,
  transportLeg?: TransportTimelineLeg
): boolean {
  if (entry.journeyType !== 'return') return false;
  return (
    transportLeg === 'return' ||
    (!transportLeg && isTransportReturnOnCalendarDate(entry, calendarDate))
  );
}

/** Title for transport cards — return legs show reversed from → to. */
export function deriveTransportDisplayTitle(
  entry: ItineraryEntry,
  calendarDate: string,
  transportLeg?: TransportTimelineLeg
): string {
  const returnLeg = isReturnLegDisplay(entry, calendarDate, transportLeg);
  let from = (entry.transportFrom || '').trim();
  let to = (entry.transportTo || '').trim();
  const mode = (entry.transportMode || '').trim();

  if (from || to) {
    if (returnLeg) {
      const swap = from;
      from = to;
      to = swap;
    }
    const arrow = from || to ? `${from} → ${to}` : '';
    return (arrow + (mode ? ` (${mode})` : '')).trim() || 'Transport';
  }

  const raw = (entry.title || '').trim();
  if (!raw) return 'Transport';
  return returnLeg ? flipArrowTitle(raw) : raw;
}
