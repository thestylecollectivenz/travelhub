import * as React from 'react';
import type { ItineraryEntry } from '../../models/ItineraryEntry';
import { usePlaces } from '../../context/PlacesContext';
import { useTripWorkspace } from '../../context/TripWorkspaceContext';
import {
  isLocationInfoEntry,
  locationHighlightRows,
  locationInfoPlaceId,
  parseLocationInfoNotes
} from '../../utils/locationInfoEntry';
import { compactPlaceLabel } from '../../utils/placeDisplayLabel';
import { isTripHomePlace } from '../../utils/tripHomePlaces';
import { LocationInfoStripPinIcon } from './LocationInfoPanelContent';
import styles from './DayLocationInfoStrip.module.css';

export interface DayLocationInfoStripProps {
  entries: ItineraryEntry[];
  activeEntryId?: string | null;
  /** Day primary overnight / first place — darker pill when variant is pills. */
  primaryEntryId?: string | null;
  onSelect: (entryId: string) => void;
  /** Mobile itinerary mockup: open pill chips without the desktop strip chrome. */
  variant?: 'default' | 'pills';
}

function progressForEntry(entry: ItineraryEntry): { done: number; total: number } {
  const data = parseLocationInfoNotes(entry.notes);
  if (!data) return { done: 0, total: 0 };
  const rows = locationHighlightRows(data);
  const dining = data.diningSuggestions ?? [];
  const all = [...rows, ...dining];
  if (!all.length) return { done: 0, total: 0 };
  const done = rows.filter((x) => x.done).length + dining.filter((x) => x.done).length;
  return { done, total: all.length };
}

export const DayLocationInfoStrip: React.FC<DayLocationInfoStripProps> = ({
  entries,
  activeEntryId,
  primaryEntryId,
  onSelect,
  variant = 'default'
}) => {
  const { placeById } = usePlaces();
  const { trip } = useTripWorkspace();
  const locationEntries = React.useMemo(
    () => entries.filter((e) => isLocationInfoEntry(e) && !e.parentEntryId),
    [entries]
  );

  if (!locationEntries.length) return null;

  const resolvedPrimary = primaryEntryId || locationEntries[0]?.id;

  return (
    <div
      className={`${styles.strip} ${variant === 'pills' ? styles.stripPills : ''}`}
      role="navigation"
      aria-label="Places visited today"
    >
      {locationEntries.map((entry) => {
        const data = parseLocationInfoNotes(entry.notes);
        const place = data ? placeById(data.placeId) : undefined;
        const label = place
          ? compactPlaceLabel(place.title, place.country)
          : (entry.title || entry.location || 'Place').trim() || 'Place';
        const short = label.split(',')[0].trim();
        const { done, total } = progressForEntry(entry);
        const complete = total > 0 && done === total;
        const partial = total > 0 && done > 0 && done < total;
        const active = activeEntryId === entry.id;
        const isPrimary = variant === 'pills' && entry.id === resolvedPrimary;
        const isHome = isTripHomePlace(trip, locationInfoPlaceId(entry) || data?.placeId);

        return (
          <button
            key={entry.id}
            type="button"
            className={`${styles.chip} ${variant === 'pills' ? styles.chipPill : ''} ${isPrimary ? styles.chipPrimary : ''} ${active ? styles.chipActive : ''} ${complete ? styles.chipComplete : ''} ${isHome ? styles.chipHome : ''}`}
            title={isHome ? `${label} (Home)` : label}
            aria-label={`${label}${total ? ` — ${done} of ${total} done` : ''}${isPrimary ? ' (primary)' : ''}${isHome ? ' (home)' : ''}`}
            onClick={() => onSelect(entry.id)}
          >
            <span className={styles.chipIcon}>
              <LocationInfoStripPinIcon />
            </span>
            <span className={styles.chipLabel}>
              {short}
              {isHome ? <span className={styles.chipHomeMark}> ⌂</span> : null}
              {variant === 'pills' ? <span aria-hidden> ›</span> : null}
            </span>
            {partial ? <span className={styles.chipDot} aria-hidden /> : null}
          </button>
        );
      })}
    </div>
  );
};
