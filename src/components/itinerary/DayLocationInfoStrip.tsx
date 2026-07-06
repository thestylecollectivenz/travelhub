import * as React from 'react';
import type { ItineraryEntry } from '../../models/ItineraryEntry';
import { usePlaces } from '../../context/PlacesContext';
import {
  isLocationInfoEntry,
  locationHighlightRows,
  parseLocationInfoNotes
} from '../../utils/locationInfoEntry';
import { compactPlaceLabel } from '../../utils/placeDisplayLabel';
import { LocationInfoStripPinIcon } from './LocationInfoPanelContent';
import styles from './DayLocationInfoStrip.module.css';

export interface DayLocationInfoStripProps {
  entries: ItineraryEntry[];
  activeEntryId?: string | null;
  onSelect: (entryId: string) => void;
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
  onSelect
}) => {
  const { placeById } = usePlaces();
  const locationEntries = React.useMemo(
    () => entries.filter((e) => isLocationInfoEntry(e) && !e.parentEntryId),
    [entries]
  );

  if (!locationEntries.length) return null;

  return (
    <div className={styles.strip} role="navigation" aria-label="Places visited today">
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

        return (
          <button
            key={entry.id}
            type="button"
            className={`${styles.chip} ${active ? styles.chipActive : ''} ${complete ? styles.chipComplete : ''}`}
            title={label}
            aria-label={`${label}${total ? ` — ${done} of ${total} done` : ''}`}
            onClick={() => onSelect(entry.id)}
          >
            <span className={styles.chipIcon}>
              <LocationInfoStripPinIcon />
            </span>
            <span className={styles.chipLabel}>{short}</span>
            {partial ? <span className={styles.chipDot} aria-hidden /> : null}
          </button>
        );
      })}
    </div>
  );
};
