import * as React from 'react';
import type { Trip } from '../../models/Trip';
import { useTripWorkspace } from '../../context/TripWorkspaceContext';
import { usePlaces } from '../../context/PlacesContext';
import { useConfig } from '../../context/ConfigContext';
import type { PlaceCandidate } from '../../models/Place';
import type { ItineraryEntry } from '../../models/ItineraryEntry';
import {
  parseCruiseItineraryFromHtml,
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
  const [url, setUrl] = React.useState('');
  const [pasteText, setPasteText] = React.useState('');
  const [showPasteFallback, setShowPasteFallback] = React.useState(false);
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

  const handleFetchAndParse = React.useCallback(async () => {
    resetPreview();
    const trimmed = url.trim();
    if (!trimmed) {
      setError('Enter a cruise itinerary URL.');
      return;
    }
    setLoading(true);
    setShowPasteFallback(false);
    try {
      let html: string;
      try {
        const res = await fetch(trimmed, { mode: 'cors', credentials: 'omit', cache: 'no-store' });
        if (!res.ok) throw new Error(`Could not load page (${res.status}).`);
        html = await res.text();
      } catch (fetchErr) {
        const name = fetchErr instanceof Error ? fetchErr.name : '';
        const msg = fetchErr instanceof Error ? fetchErr.message : String(fetchErr);
        if (name === 'TypeError' || msg.includes('Failed to fetch') || msg.includes('NetworkError')) {
          setShowPasteFallback(true);
          setError(
            'Could not fetch this URL directly (often blocked by CORS). Please paste the itinerary text below instead, or use “Manual entry”.'
          );
          setLoading(false);
          return;
        }
        throw fetchErr;
      }
      const rows = parseCruiseItineraryFromHtml(trimmed, html);
      if (!rows.length) {
        setShowPasteFallback(true);
        setError('No port rows were recognised from that page. Paste the itinerary text below instead.');
        setLoading(false);
        return;
      }
      setParsed(rows);
      setError('');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Import failed.');
    } finally {
      setLoading(false);
    }
  }, [url, resetPreview]);

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
      setUrl('');
      setPasteText('');
      setParsed([]);
      setShowPasteFallback(false);
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
          <span className={styles.hint}>Paste a cruise line itinerary URL or page text (Holland America pages supported).</span>
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
            <label className={styles.label} htmlFor="cruise-import-url">
              Itinerary URL
            </label>
            <input
              id="cruise-import-url"
              className={styles.input}
              type="url"
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              placeholder="https://www.hollandamerica.com/..."
            />
            <div className={styles.actions}>
              <button
                type="button"
                className={styles.primaryBtn}
                disabled={loading}
                onClick={() => {
                  handleFetchAndParse().catch(() => undefined);
                }}
              >
                {loading ? 'Working…' : 'Fetch and parse'}
              </button>
            </div>
          </div>
          <div className={styles.row}>
            <label className={styles.label} htmlFor="cruise-import-paste">
              {showPasteFallback ? 'Paste itinerary text (URL was blocked or unreadable)' : 'Or paste itinerary text'}
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
                Parse pasted text
              </button>
              <a className={styles.ghostBtn} href="https://www.hollandamerica.com/" target="_blank" rel="noopener noreferrer">
                Open Holland America (example)
              </a>
            </div>
            <p className={styles.hint}>
              Many cruise sites block cross-origin fetch; pasting the visible page text usually works.
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
