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
  const hasCalendarDates = React.useMemo(
    () => daysForTrip.some((d) => d.dayType !== 'PreTrip' && Boolean((d.calendarDate || '').trim())),
    [daysForTrip]
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
      const rowDate = (row.date || '').trim();
      if (rowDate) {
        const byDate = daysForTrip.find((d) => d.dayType !== 'PreTrip' && d.calendarDate === rowDate);
        if (byDate) return byDate;
        if (hasCalendarDates) return undefined;
      }
      const byNum = daysForTrip.find((d) => d.dayNumber === row.dayNumber);
      if (byNum) return byNum;
      const idx = row.dayNumber - 1;
      if (idx >= 0 && idx < daysForTrip.length) return daysForTrip[idx];
      return undefined;
    },
    [daysForTrip, hasCalendarDates]
  );

  const isSeaOrScenicLine = React.useCallback((port: string): boolean => {
    const p = (port || '').toLowerCase();
    if (p.includes('days at sea') || p.includes('day at sea')) return true;
    if (/\bat sea\b/.test(p)) return true;
    if (p.includes('scenic')) return true;
    if (p.includes('crossing the arctic')) return true;
    if (p.includes('cruising only')) return true;
    return false;
  }, []);

  const seaDayTitle = React.useCallback((port: string): string => {
    const p = (port || '').toLowerCase();
    if (p.includes('days at sea') || p.includes('day at sea') || /\bat sea\b/.test(p)) {
      return 'Sea day';
    }
    return port;
  }, []);

  const scoreCandidate = React.useCallback((candidate: PlaceCandidate, rowPort: string): number => {
    const normalize = (v: string): string =>
      (v || '')
        .toLowerCase()
        .replace(/^the\s+/, '')
        .replace(/[^\w\s,]/g, ' ')
        .replace(/\s+/g, ' ')
        .trim();
    const parts = rowPort.split(',').map((x) => x.trim()).filter(Boolean);
    const city = normalize(parts[0] || '');
    const country = normalize(parts.slice(1).join(', '));
    const title = normalize(candidate.title || '');
    const candCountry = normalize(candidate.country || '');
    let score = 0;
    if (city && title.includes(city)) score += 6;
    if (city && title.startsWith(city)) score += 2;
    if (country && (candCountry.includes(country) || title.includes(country))) score += 8;
    if (title.includes('port') || title.includes('harbor') || title.includes('harbour')) score += 1;
    return score;
  }, []);

  const geocodePort = React.useCallback(
    async (portName: string): Promise<PlaceCandidate | null> => {
      const q1 = `${portName} cruise port`;
      let results = await searchPlaces(q1);
      if (!results.length) {
        results = await searchPlaces(portName);
      }
      if (!results.length) return null;
      const ranked = [...results]
        .map((c) => ({ c, score: scoreCandidate(c, portName) }))
        .sort((a, b) => b.score - a.score);
      return ranked[0]?.c ?? null;
    },
    [scoreCandidate, searchPlaces]
  );

  const handleApply = React.useCallback(async () => {
    if (!parsed.length) return;
    setLoading(true);
    setApplyWarnings([]);
    const warnings: string[] = [];
    const rowsSorted = [...parsed].sort((a, b) => {
      const ad = (a.date || '').trim();
      const bd = (b.date || '').trim();
      if (ad && bd && ad !== bd) return ad.localeCompare(bd);
      if (ad && !bd) return -1;
      if (!ad && bd) return 1;
      return a.dayNumber - b.dayNumber;
    });
    const resolved: Array<{ row: ParsedCruiseRow; dayId: string; calendarDate: string }> = [];

    const maxSortOnDay = (dayId: string): number =>
      localEntries.filter((e) => e.dayId === dayId && !e.parentEntryId).reduce((m, e) => Math.max(m, e.sortOrder), 0);

    const makeSegmentEntry = (dayId: string, row: ParsedCruiseRow, sortOrder: number): ItineraryEntry => {
      const title = isSeaOrScenicLine(row.port) ? seaDayTitle(row.port) : row.port;
      return {
        id: newTempEntryId(),
        dayId,
        tripId: trip.id,
        title,
        category: 'Other',
        timeStart: row.arrive || '',
        arrivalTime: row.depart?.trim() ? row.depart : undefined,
        duration: '',
        supplier: '',
        location: row.port,
        notes: row.date ? `Cruise import · ${row.date}` : 'Cruise import',
        decisionStatus: 'Planned',
        bookingRequired: false,
        bookingStatus: 'Not booked',
        paymentStatus: 'Not paid',
        amount: 0,
        currency: config.homeCurrency?.trim() || 'NZD',
        sortOrder
      };
    };

    try {
      type Hit = { row: ParsedCruiseRow; day: (typeof daysForTrip)[0] };
      const hits: Hit[] = [];
      for (const row of rowsSorted) {
        const day = resolveDay(row);
        if (!day) {
          if (row.date) {
            warnings.push(`No trip day matched date ${row.date} (${row.port}).`);
          } else {
            warnings.push(`No trip day matched “Day ${row.dayNumber}” (${row.port}).`);
          }
          continue;
        }
        if (day.dayType === 'PreTrip') {
          warnings.push(`Skipped pre-trip day ${row.dayNumber} for ${row.port}.`);
          continue;
        }
        hits.push({ row, day });
      }

      if (!hits.length) {
        setApplyWarnings(warnings);
        setError('Nothing was applied. Check day numbers match your trip days, or add days manually.');
        setLoading(false);
        return;
      }

      const byDayId = new Map<string, ParsedCruiseRow[]>();
      for (const { row, day } of hits) {
        const list = byDayId.get(day.id) ?? [];
        list.push(row);
        byDayId.set(day.id, list);
      }

      const dayProcessOrder = daysForTrip.filter((d) => d.tripId === trip.id && d.dayType !== 'PreTrip');

      const sortCursorByDay = new Map<string, number>();
      for (const d of dayProcessOrder) {
        if (byDayId.get(d.id)?.length) {
          sortCursorByDay.set(d.id, maxSortOnDay(d.id));
        }
      }

      for (const day of dayProcessOrder) {
        const rows = byDayId.get(day.id);
        if (!rows?.length) continue;

        const landRows = rows.filter((r) => !isSeaOrScenicLine(r.port));
        const seaRows = rows.filter((r) => isSeaOrScenicLine(r.port));
        const ordered = [...landRows, ...seaRows];

        let firstLandPlaceId: string | undefined;
        let firstLandTitle: string | undefined;

        for (const row of ordered) {
          const nextSort = (sortCursorByDay.get(day.id) ?? 0) + 1;
          sortCursorByDay.set(day.id, nextSort);

          if (isSeaOrScenicLine(row.port)) {
            updateEntry(makeSegmentEntry(day.id, row, nextSort));
            resolved.push({ row, dayId: day.id, calendarDate: day.calendarDate });
            await delay(250);
            continue;
          }

          const candidate = await geocodePort(row.port);
          if (!candidate) {
            warnings.push(`No geocode result for “${row.port}” (${day.calendarDate || `day ${day.dayNumber}`}).`);
            updateEntry(makeSegmentEntry(day.id, row, nextSort));
            resolved.push({ row, dayId: day.id, calendarDate: day.calendarDate });
            await delay(250);
            continue;
          }

          const place = await createOrReusePlace({ ...candidate, placeType: 'port' });
          if (!firstLandPlaceId) {
            firstLandPlaceId = place.id;
            firstLandTitle = row.port;
          }
          updateEntry(makeSegmentEntry(day.id, row, nextSort));
          resolved.push({ row, dayId: day.id, calendarDate: day.calendarDate });
          await delay(650);
        }

        const seaOnly = landRows.length === 0;
        updateDay(day.id, {
          dayType: seaOnly ? 'Sea' : 'PlacePort',
          primaryPlaceId: seaOnly ? undefined : firstLandPlaceId,
          displayTitle: seaOnly ? (seaRows[0] ? seaDayTitle(seaRows[0].port) : 'Sea day') : firstLandTitle || day.displayTitle,
          additionalPlaceIds: []
        });
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

      const cruiseSortOrder = (sortCursorByDay.get(embarkDayId) ?? maxSortOnDay(embarkDayId)) + 1;

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
        sortOrder: cruiseSortOrder
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
    config.homeCurrency,
    seaDayTitle,
    isSeaOrScenicLine,
    daysForTrip
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
                    {r.date ? `${r.date} — ` : `Day ${r.dayNumber} — `}
                    {r.port} (Arrive {r.arrive || '—'}, Depart {r.depart || '—'})
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
