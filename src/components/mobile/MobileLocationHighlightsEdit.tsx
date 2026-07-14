import * as React from 'react';
import * as ReactDOM from 'react-dom';
import type { ItineraryEntry } from '../../models/ItineraryEntry';
import type { Place } from '../../models/Place';
import { useConfig } from '../../context/ConfigContext';
import { useTripWorkspace } from '../../context/TripWorkspaceContext';
import {
  locationHighlightRows,
  normalizeLocationInfoNotes,
  parseLocationInfoNotes,
  serializeLocationInfoNotes,
  splitHighlightRows,
  type LocationHighlightRow,
  type LocationInfoNotes
} from '../../utils/locationInfoEntry';
import { LocationInfoHighlights } from '../itinerary/LocationInfoHighlights';
import { useShellMode } from '../../hooks/useShellMode';
import styles from './MobileLocationHighlightsEdit.module.css';

export interface MobileLocationHighlightsEditProps {
  entry: ItineraryEntry;
  place: Place | undefined;
  onBack: () => void;
}

export const MobileLocationHighlightsEdit: React.FC<MobileLocationHighlightsEditProps> = ({
  entry,
  place,
  onBack
}) => {
  const { config } = useConfig();
  const { updateEntry } = useTripWorkspace();
  const shellMode = useShellMode();
  const data = parseLocationInfoNotes(entry.notes);
  const [rows, setRows] = React.useState<LocationHighlightRow[]>(() =>
    data ? locationHighlightRows(data) : []
  );

  React.useEffect(() => {
    const parsed = parseLocationInfoNotes(entry.notes);
    setRows(parsed ? locationHighlightRows(parsed) : []);
  }, [entry.id, entry.notes]);

  React.useEffect(() => {
    const onKey = (ev: KeyboardEvent): void => {
      if (ev.key === 'Escape') onBack();
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [onBack]);

  if (!data) return null;

  const persistRows = (nextRows: LocationHighlightRow[]): void => {
    setRows(nextRows);
    const next: LocationInfoNotes = { ...data, ...splitHighlightRows(nextRows) };
    updateEntry({ ...entry, notes: serializeLocationInfoNotes(normalizeLocationInfoNotes(next)) });
  };

  const shellAttr = shellMode === 'ipad-portrait' ? 'ipad-portrait' : undefined;

  return ReactDOM.createPortal(
    <div className={styles.overlay} role="presentation" data-shell={shellAttr}>
      <div className={styles.panel} role="dialog" aria-modal="true" aria-label="Edit highlights">
        <header className={styles.header}>
          <button type="button" className={styles.backBtn} onClick={onBack}>
            ‹ Back
          </button>
          <h2 className={styles.title}>Highlights</h2>
          <button type="button" className={styles.closeBtn} onClick={onBack} aria-label="Close">
            ×
          </button>
        </header>
        <div className={styles.body}>
          <p className={styles.hint}>Add, remove, or refresh highlights by category. Check off items on the main location screen.</p>
          <LocationInfoHighlights
            rows={rows}
            onChange={persistRows}
            entry={entry}
            place={place}
            geminiApiKey={config.geminiApiKey || ''}
            hasAnyContent={rows.length > 0}
            className={styles.highlightsLarge}
            onGenerationComplete={() => {
              const parsed = parseLocationInfoNotes(entry.notes);
              if (parsed) setRows(locationHighlightRows(parsed));
            }}
          />
        </div>
      </div>
    </div>,
    document.body
  );
};
