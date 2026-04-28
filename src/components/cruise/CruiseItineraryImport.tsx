import * as React from 'react';
import type { Trip } from '../../models/Trip';
import { useTripWorkspace } from '../../context/TripWorkspaceContext';
import { usePlaces } from '../../context/PlacesContext';
import { useConfig } from '../../context/ConfigContext';
import type { PlaceCandidate } from '../../models/Place';
import type { ItineraryEntry } from '../../models/ItineraryEntry';
import {
  parseCruiseItineraryFromText,
  type ParsedCruiseRow
} from '../../utils/cruiseItineraryImportParser';
import styles from './CruiseItineraryImport.module.css';

function newTempEntryId(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return `temp-${crypto.randomUUID()}`;
  }
  return `temp-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export interface CruiseItineraryImportProps {
  trip: Trip;
}

export const CruiseItineraryImport: React.FC<CruiseItineraryImportProps> = ({ trip }) => {
  const { tripDays, localEntries, updateDay, updateEntry } = useTripWorkspace();
  const { searchPlaces, createOrReusePlace } = usePlaces();
  const { config } = useConfig();

  const [open, setOpen] = React.useState(false);
  const [pasteText, setPasteText] = React.useState('');
  const [error, setError] = React.useState('');
  const [loading, setLoading] = React.useState(false);
  const [parsed, setParsed] = React.useState<ParsedCruiseRow[]>([]);
  const [applyWarnings, setApplyWarnings] = React.useState<string[]>([]);
  const [postApplyNotes, setPostApplyNotes] = React.useState<string[]>([]);

  const daysForTrip = React.useMemo(
    () => tripDays.filter((d) => d.tripId === trip.id).sort((a, b) => a.dayNumber - b.dayNumber),
    [tripDays, trip.id]
  );

  const resetPreview = React.useCallback(() => {
    setParsed([]);
    setError('');
    setApplyWarnings([]);
  }, []);

  const handleParsePasted = React.useCallback(() => {
    resetPreview();
    const text = pasteText.trim();
    if (!text) {
      setError('Paste itinerary text first.');
      return;
    }
    const rows = parseCruiseItineraryFromText(text);
    if (!rows.length) {
      setError('Could not parse any port lines. Try copying the port table from the cruise line site, or use Manual entry to add days by hand.');
      return;
    }
    setParsed(rows);
    setError('');
  }, [pasteText, resetPreview]);

  const resolveDay = React.useCallback(
    (row: ParsedCruiseRow) => {
      const byNum = daysForTrip.find((d) => d.dayNumber === row.dayNumber);
      if (byNum) return byNum;
      const idx = row.dayNumber - 1;
      if (idx >= 0 && idx < daysForTrip.length) return daysForTrip[idx];
      return undefined;
    },
    [daysForTrip]
  );

  const geocodePort = React.useCallback(
    async (portName: string): Promise<PlaceCandidate | null> => {
      const q1 = `${portName} cruise port`;
      let results = await searchPlaces(q1);
      if (!results.length) {
        results = await searchPlaces(portName);
      }
      const c = results[0];
      return c ?? null;
    },
    [searchPlaces]
  );

  const handleApply = React.useCallback(async () => {
    if (!parsed.length) return;
    setLoading(true);
    setApplyWarnings([]);
    const warnings: string[] = [];
    const rowsSorted = [...parsed].sort((a, b) => a.dayNumber - b.dayNumber);
    const resolved: Array<{ row: ParsedCruiseRow; dayId: string; calendarDate: string }> = [];

    try {
      for (let i = 0; i < rowsSorted.length; i++) {
        const row = rowsSorted[i];
        const day = resolveDay(row);
        if (!day) {
          warnings.push(`No trip day matched “Day ${row.dayNumber}” (${row.port}).`);
          continue;
        }
        if (day.dayType === 'PreTrip') {
          warnings.push(`Skipped pre-trip day ${row.dayNumber} for ${row.port}.`);
          continue;
        }
        const candidate = await geocodePort(row.port);
        if (!candidate) {
          warnings.push(`No geocode result for “${row.port}”.`);
          continue;
        }
        const place = await createOrReusePlace({ ...candidate, placeType: 'port' });
        updateDay(day.id, {
          displayTitle: row.port,
          primaryPlaceId: place.id,
          additionalPlaceIds: []
        });
        resolved.push({ row, dayId: day.id, calendarDate: day.calendarDate });
        if (i < rowsSorted.length - 1) await delay(650);
      }

      if (resolved.length === 0) {
        setApplyWarnings(warnings);
        setError('Nothing was applied. Check day numbers match your trip days, or add days manually.');
        setLoading(false);
        return;
      }

      const first = resolved[0];
      const last = resolved[resolved.length - 1];
      const embarkDayId = first.dayId;
      const embarkCal = first.calendarDate;
      const disembarkCal = last.calendarDate;

      const siblings = localEntries.filter((e) => e.dayId === embarkDayId && !e.parentEntryId);
      const maxSort = siblings.reduce((m, e) => Math.max(m, e.sortOrder), 0);

      const firstArrive = resolved.map((r) => r.row.arrive).find(Boolean) ?? '09:00';
      const lastDepart = [...resolved].reverse().map((r) => r.row.depart).find(Boolean) ?? '';

      const cruiseEntry: ItineraryEntry = {
        id: newTempEntryId(),
        dayId: embarkDayId,
        tripId: trip.id,
        title: `Cruise — ${trip.title}`,
        category: 'Cruise',
        timeStart: firstArrive,
        arrivalTime: lastDepart || undefined,
        embarksDate: embarkCal,
        disembarksDate: disembarkCal,
        duration: '',
        supplier: '',
        location: trip.destination,
        notes: `Imported ${parsed.length} port line(s) from cruise itinerary.`,
        decisionStatus: 'Planned',
        bookingRequired: false,
        bookingStatus: 'Not booked',
        paymentStatus: 'Not paid',
        amount: 0,
        currency: config.homeCurrency?.trim() || 'NZD',
        sortOrder: maxSort + 1
      };

      updateEntry(cruiseEntry);
      setPostApplyNotes(warnings);
      setApplyWarnings([]);
      setOpen(false);
      setPasteText('');
      setParsed([]);
      setError('');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Apply failed.');
    } finally {
      setLoading(false);
    }
  }, [
    parsed,
    resolveDay,
    geocodePort,
    createOrReusePlace,
    updateDay,
    localEntries,
    trip.id,
    trip.title,
    trip.destination,
    updateEntry,
    config.homeCurrency
  ]);

  React.useEffect(() => {
    const onOpen = (): void => {
      setOpen(true);
      setError('');
    };
    window.addEventListener('open-cruise-import', onOpen);
    return () => window.removeEventListener('open-cruise-import', onOpen);
  }, []);

  return (
    <div className={styles.root}>
      <div className={styles.triggerRow}>
        <button
          type="button"
          className={styles.secondaryBtn}
          onClick={() => {
            setOpen((o) => {
              const next = !o;
              if (next) setPostApplyNotes([]);
              return next;
            });
          }}
        >
          {open ? 'Hide import cruise itinerary' : 'Import cruise itinerary'}
        </button>
        {!open ? (
          <span className={styles.hint}>Paste itinerary text from a Holland America voyage page.</span>
        ) : null}
      </div>
      {postApplyNotes.length ? (
        <div className={styles.warnings} role="status">
          Import applied.
          {postApplyNotes.map((w, i) => (
            <div key={i}>{w}</div>
          ))}
        </div>
      ) : null}
      {open ? (
        <div className={styles.panel} role="region" aria-label="Import cruise itinerary">
          <div className={styles.row}>
            <label className={styles.label} htmlFor="cruise-import-paste">
              Go to the Holland America voyage page, select all page text (Ctrl+A, Ctrl+C), and paste it here
            </label>
            <textarea
              id="cruise-import-paste"
              className={styles.textarea}
              value={pasteText}
              onChange={(e) => setPasteText(e.target.value)}
              placeholder="Paste the full port table or itinerary text from the site…"
            />
            <div className={styles.actions}>
              <button type="button" className={styles.secondaryBtn} disabled={loading} onClick={handleParsePasted}>
                Parse itinerary
              </button>
            </div>
            <p className={styles.hint}>
              Direct fetch is disabled due to CORS restrictions; paste-only mode is used for reliable import.
            </p>
          </div>
          {error ? (
            <div className={styles.error} role="alert">
              {error}
            </div>
          ) : null}
          {parsed.length ? (
            <div className={styles.row}>
              <div className={styles.label}>Review before applying</div>
              <ol className={styles.preview}>
                {parsed.map((r, i) => (
                  <li key={`${r.dayNumber}-${r.port}-${i}`}>
                    Day {r.dayNumber} — {r.port} (Arrive {r.arrive || '—'}, Depart {r.depart || '—'})
                  </li>
                ))}
              </ol>
              <div className={styles.actions}>
                <button
                  type="button"
                  className={styles.primaryBtn}
                  disabled={loading}
                  onClick={() => {
                    handleApply().catch(() => undefined);
                  }}
                >
                  {loading ? 'Applying…' : 'Apply to trip'}
                </button>
                <button type="button" className={styles.secondaryBtn} disabled={loading} onClick={resetPreview}>
                  Clear preview
                </button>
              </div>
            </div>
          ) : null}
          {applyWarnings.length ? (
            <div className={styles.warnings}>
              {applyWarnings.map((w, i) => (
                <div key={i}>{w}</div>
              ))}
            </div>
          ) : null}
        </div>
      ) : null}
    </div>
  );
};
