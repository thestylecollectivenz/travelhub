import * as React from 'react';
import type { Trip } from '../../models/Trip';
import { useTripWorkspace } from '../../context/TripWorkspaceContext';
import { usePlaces } from '../../context/PlacesContext';
import { useConfig } from '../../context/ConfigContext';
import type { PlaceCandidate } from '../../models/Place';
import type { ItineraryEntry, ItinerarySubItem } from '../../models/ItineraryEntry';
import {
  parseCruiseItineraryFromText,
  type ParsedCruiseRow
} from '../../utils/cruiseItineraryImportParser';
import { splitCruiseShipMeta } from '../../utils/cruisePortSanitize';
import {
  cruisePortSearchQueries,
  cruiseSeaDaySearchQueries,
  pickBestGeocodeCandidate
} from '../../utils/cruisePortGeocode';
import { buildCruiseImportReport } from '../../utils/cruiseImportReport';
import { CopyableReportModal } from '../shared/CopyableReportModal';
import {
  detectCruiseImportConflict,
  entriesToRemoveForCruiseOverwrite
} from '../../utils/cruiseImportDetect';
import {
  snapshotTripDateRange,
  snapshotTripDayIds,
  tripDateRangeChanged,
  tripDaysMissingFromSnapshot
} from '../../utils/cruiseImportGuards';
import type { Place } from '../../models/Place';
import {
  CruiseImportConflictDialog,
  type CruiseImportApplyMode
} from './CruiseImportConflictDialog';
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
  const { tripDays, localEntries, updateDay, updateEntry, deleteEntry, retryLoad } = useTripWorkspace();
  const { searchPlaces, createOrReusePlace, places } = usePlaces();
  const { config } = useConfig();

  const [open, setOpen] = React.useState(false);
  const [pasteText, setPasteText] = React.useState('');
  const [error, setError] = React.useState('');
  const [loading, setLoading] = React.useState(false);
  const [parsed, setParsed] = React.useState<ParsedCruiseRow[]>([]);
  const [applyWarnings, setApplyWarnings] = React.useState<string[]>([]);
  const [importReport, setImportReport] = React.useState<string | null>(null);
  const [conflictDialog, setConflictDialog] = React.useState<{
    affectedDayCount: number;
    existingCount: number;
    targetDayIds: Set<string>;
  } | null>(null);

  const daysForTrip = React.useMemo(
    () => tripDays.filter((d) => d.tripId === trip.id).sort((a, b) => a.dayNumber - b.dayNumber),
    [tripDays, trip.id]
  );
  const itineraryDays = React.useMemo(
    () => daysForTrip.filter((d) => d.dayType !== 'PreTrip'),
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
        const byDate = itineraryDays.find((d) => (d.calendarDate || '').slice(0, 10) === rowDate.slice(0, 10));
        if (byDate) return byDate;
      }
      // Match by trip day number only — never by list position (avoids mapping cruise "day N" onto the wrong calendar day).
      return itineraryDays.find((d) => d.dayNumber === row.dayNumber);
    },
    [itineraryDays]
  );

  const isSeaOrScenicLine = React.useCallback((port: string): boolean => {
    const p = (port || '').toLowerCase();
    if (p.includes('days at sea') || p.includes('day at sea')) return true;
    if (/\bat sea\b/.test(p)) return true;
    if (p.includes('scenic')) return true;
    if (p.includes('crossing the arctic')) return true;
    if (p.includes('cruising only')) return true;
    if (p.includes('antarctic experience')) return true;
    if (p.includes('drake passage')) return true;
    if (p.includes('glacier alley')) return true;
    if (p.includes('beagle channel')) return true;
    if (p.includes('strait of magellan')) return true;
    if (p.includes('chilean fjords')) return true;
    if (p.includes('daylight cruising')) return true;
    if (/\bcruising\b/.test(p) && /\b(channel|fjord|passage|strait|sound|gulf)\b/.test(p)) return true;
    if (/\bchannel\b/.test(p) && !/\benglish\b/.test(p)) return true;
    if (/\bsarmiento\b/.test(p)) return true;
    return false;
  }, []);

  const matchExistingPlace = React.useCallback((portName: string, knownPlaces: Place[]): PlaceCandidate | null => {
    const normalize = (v: string): string =>
      (v || '')
        .toLowerCase()
        .replace(/^the\s+/, '')
        .replace(/[^\w\s,]/g, ' ')
        .replace(/\s+/g, ' ')
        .trim();
    const city = normalize(portName.split(',')[0] || portName);
    if (!city) return null;
    let best: Place | undefined;
    let bestScore = 0;
    for (const p of knownPlaces) {
      const title = normalize(p.title);
      let score = 0;
      if (title.includes(city)) score += 6;
      if (title.startsWith(city)) score += 3;
      if (score > bestScore) {
        bestScore = score;
        best = p;
      }
    }
    if (!best || bestScore < 6) return null;
    return {
      title: best.title,
      latitude: best.latitude,
      longitude: best.longitude,
      country: best.country,
      countryCode: best.countryCode,
      placeType: best.placeType,
      timeZone: best.timeZone,
      nominatimId: best.nominatimId
    };
  }, []);

  const seaDayTitle = React.useCallback((port: string): string => {
    const p = (port || '').toLowerCase();
    if (p.includes('days at sea') || p.includes('day at sea') || /\bat sea\b/.test(p)) {
      return 'Sea day';
    }
    return port;
  }, []);

  const displayTitleForRow = React.useCallback(
    (row: ParsedCruiseRow): string => {
      const split = splitCruiseShipMeta(row.port);
      const clean = (split.clean || row.port || '').trim();
      if (isSeaOrScenicLine(row.port)) return seaDayTitle(row.port);
      return clean || row.port.trim();
    },
    [isSeaOrScenicLine, seaDayTitle]
  );

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

  const geocodeWithQueries = React.useCallback(
    async (portName: string, queries: string[], knownPlaces: Place[]): Promise<PlaceCandidate | null> => {
      const existing = matchExistingPlace(portName, knownPlaces);
      if (existing) return existing;
      let best: PlaceCandidate | null = null;
      let bestScore = -1;
      for (const q of queries) {
        try {
          const results = await searchPlaces(q);
          const pick = pickBestGeocodeCandidate(results, portName, scoreCandidate);
          if (!pick) continue;
          const score = scoreCandidate(pick, portName);
          if (score > bestScore) {
            bestScore = score;
            best = pick;
          }
          if (score >= 10) break;
        } catch {
          /* try next query variant */
        }
      }
      return best;
    },
    [matchExistingPlace, scoreCandidate, searchPlaces]
  );

  const geocodePort = React.useCallback(
    async (portName: string, knownPlaces: Place[]): Promise<PlaceCandidate | null> =>
      geocodeWithQueries(portName, cruisePortSearchQueries(portName), knownPlaces),
    [geocodeWithQueries]
  );

  const geocodeSeaLine = React.useCallback(
    async (portName: string, knownPlaces: Place[]): Promise<PlaceCandidate | null> => {
      const queries = cruiseSeaDaySearchQueries(portName);
      if (!queries.length) return null;
      return geocodeWithQueries(portName, queries, knownPlaces);
    },
    [geocodeWithQueries]
  );

  const runApply = React.useCallback(async (applyMode: CruiseImportApplyMode, overwriteDayIds?: Set<string>) => {
    if (!parsed.length || applyMode === 'cancel') return;
    const dayIdsBefore = snapshotTripDayIds(tripDays, trip.id);
    const dateRangeBefore = snapshotTripDateRange(trip);
    setLoading(true);
    setApplyWarnings([]);
    const otherNotes: string[] = [];
    let skippedCount = 0;
    const mapPinMisses: Array<{ port: string; date: string }> = [];
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

    const makeSegmentEntry = (
      dayId: string,
      row: ParsedCruiseRow,
      sortOrder: number,
      displayPort: string,
      shipMeta?: string
    ): ItineraryEntry => {
      const atSea = isSeaOrScenicLine(row.port);
      const title = atSea ? seaDayTitle(row.port) : displayPort;
      const home = config.homeCurrency?.trim() || 'NZD';
      const metaSub: ItinerarySubItem | undefined =
        !atSea && shipMeta
          ? {
              id: newTempEntryId(),
              title: `Ship / operator: ${shipMeta}`,
              decisionStatus: 'Planned',
              paymentStatus: 'Not paid',
              amount: 0,
              currency: home
            }
          : undefined;
      return {
        id: newTempEntryId(),
        dayId,
        tripId: trip.id,
        title,
        category: atSea ? 'Cruise at sea' : 'Cruise port',
        timeStart: row.arrive || '',
        arrivalTime: row.depart?.trim() ? row.depart : undefined,
        duration: '',
        supplier: '',
        location: displayPort,
        notes: [row.date ? `Cruise import · ${row.date}` : 'Cruise import', row.importNotes?.trim()]
          .filter(Boolean)
          .join('\n'),
        decisionStatus: 'Planned',
        bookingRequired: false,
        bookingStatus: 'Not booked',
        paymentStatus: 'Not paid',
        amount: 0,
        currency: home,
        sortOrder,
        subItems: metaSub ? [metaSub] : undefined
      };
    };

    try {
      if (applyMode === 'overwrite' && overwriteDayIds?.size) {
        const toRemove = entriesToRemoveForCruiseOverwrite(localEntries, trip.id, overwriteDayIds);
        for (const id of toRemove) {
          deleteEntry(id);
        }
        if (toRemove.length) {
          await delay(350);
        }
      }

      type Hit = { row: ParsedCruiseRow; day: (typeof daysForTrip)[0] };
      const hits: Hit[] = [];
      for (const row of rowsSorted) {
        const day = resolveDay(row);
        if (!day) {
          skippedCount += 1;
          otherNotes.push(`Could not match “${row.port}” to a trip day${row.date ? ` (${row.date})` : ''}.`);
          continue;
        }
        if (day.dayType === 'PreTrip') {
          skippedCount += 1;
          continue;
        }
        hits.push({ row, day });
      }

      if (!hits.length) {
        setApplyWarnings(otherNotes);
        setError('Nothing was applied. Check day numbers match your trip days, or add days manually.');
        setLoading(false);
        return;
      }

      const geocodeCache = new Map<string, PlaceCandidate | null>();
      const uniqueLandPorts = new Set<string>();
      const uniqueSeaLines = new Set<string>();
      for (const { row } of hits) {
        const split = splitCruiseShipMeta(row.port);
        const key = split.clean || row.port.trim();
        if (isSeaOrScenicLine(row.port)) {
          uniqueSeaLines.add(row.port.trim());
        } else {
          uniqueLandPorts.add(key);
        }
      }
      for (const port of Array.from(uniqueLandPorts)) {
        geocodeCache.set(port, await geocodePort(port, places));
      }
      for (const seaLine of Array.from(uniqueSeaLines)) {
        geocodeCache.set(`sea:${seaLine}`, await geocodeSeaLine(seaLine, places));
      }

      const byDayId = new Map<string, ParsedCruiseRow[]>();
      for (const { row, day } of hits) {
        const list = byDayId.get(day.id) ?? [];
        list.push(row);
        byDayId.set(day.id, list);
      }

      const dayProcessOrder = itineraryDays.filter((d) => d.tripId === trip.id);

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
          const split = splitCruiseShipMeta(row.port);
          const displayPort = split.clean || row.port.trim();
          const shipMeta = split.meta;

          if (isSeaOrScenicLine(row.port)) {
            const seaCandidate = geocodeCache.get(`sea:${row.port.trim()}`) ?? null;
            if (seaCandidate) {
              try {
                const scenicPlace = await createOrReusePlace({ ...seaCandidate, placeType: 'region' });
                if (!firstLandPlaceId) firstLandPlaceId = scenicPlace.id;
              } catch {
                otherNotes.push(`Could not save the map location for scenic day “${displayPort}”.`);
              }
            }
            updateEntry(makeSegmentEntry(day.id, row, nextSort, displayPort));
            resolved.push({ row, dayId: day.id, calendarDate: day.calendarDate });
            await delay(250);
            continue;
          }

          if (!firstLandTitle) {
            firstLandTitle = displayTitleForRow(row);
          }

          const candidate = geocodeCache.get(displayPort) ?? null;
          if (!candidate) {
            const dateKey = (day.calendarDate || row.date || '').slice(0, 10);
            if (!mapPinMisses.some((m) => m.port === displayPort && m.date === dateKey)) {
              mapPinMisses.push({ port: displayPort, date: dateKey });
            }
            updateEntry(makeSegmentEntry(day.id, row, nextSort, displayPort, shipMeta));
            resolved.push({ row, dayId: day.id, calendarDate: day.calendarDate });
            continue;
          }

          let place;
          try {
            place = await createOrReusePlace({ ...candidate, placeType: 'port' });
          } catch {
            otherNotes.push(`Could not save the map location for “${displayPort}”.`);
            const dateKey = (day.calendarDate || row.date || '').slice(0, 10);
            if (!mapPinMisses.some((m) => m.port === displayPort && m.date === dateKey)) {
              mapPinMisses.push({ port: displayPort, date: dateKey });
            }
            updateEntry(makeSegmentEntry(day.id, row, nextSort, displayPort, shipMeta));
            resolved.push({ row, dayId: day.id, calendarDate: day.calendarDate });
            continue;
          }
          if (!firstLandPlaceId) {
            firstLandPlaceId = place.id;
          }
          updateEntry(makeSegmentEntry(day.id, row, nextSort, displayPort, shipMeta));
          resolved.push({ row, dayId: day.id, calendarDate: day.calendarDate });
          await delay(200);
        }

        const seaOnly = landRows.length === 0;
        const titleRow = ordered[0];
        const displayTitle = titleRow
          ? displayTitleForRow(titleRow)
          : seaOnly
            ? 'Sea day'
            : day.displayTitle;
        updateDay(day.id, {
          dayType: seaOnly ? 'Sea' : 'PlacePort',
          primaryPlaceId: firstLandPlaceId,
          displayTitle,
          additionalPlaceIds: []
        });
      }

      if (resolved.length === 0) {
        setApplyWarnings(otherNotes);
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

      const missingDays = tripDaysMissingFromSnapshot(dayIdsBefore, tripDays, trip.id);
      if (missingDays.length || tripDateRangeChanged(dateRangeBefore, trip)) {
        setError(
          missingDays.length
            ? 'Import stopped: trip days must never be removed. Reloading your trip from SharePoint.'
            : 'Import stopped: trip start/end dates must not change during cruise import. Reloading from SharePoint.'
        );
        await retryLoad();
        setLoading(false);
        return;
      }

      setImportReport(
        buildCruiseImportReport({
          appliedCount: resolved.length,
          skippedCount,
          mapPinMisses,
          otherNotes
        })
      );
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
    geocodeSeaLine,
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
    itineraryDays,
    displayTitleForRow,
    places,
    deleteEntry,
    daysForTrip,
    tripDays,
    retryLoad,
    trip
  ]);

  const handleApplyClick = React.useCallback(() => {
    if (!parsed.length) return;
    const targetDayIds = new Set<string>();
    for (const row of parsed) {
      const day = resolveDay(row);
      if (day && day.dayType !== 'PreTrip') {
        targetDayIds.add(day.id);
      }
    }
    const conflict = detectCruiseImportConflict(localEntries, trip.id, daysForTrip, targetDayIds);
    if (conflict.affectedDayCount > 0 && conflict.existingCount > 0) {
      setConflictDialog({
        affectedDayCount: conflict.affectedDayCount,
        existingCount: conflict.existingCount,
        targetDayIds: conflict.affectedDayIds
      });
      return;
    }
    runApply('duplicate').catch(() => undefined);
  }, [parsed, resolveDay, localEntries, trip.id, daysForTrip, runApply]);

  const handleConflictChoice = React.useCallback(
    (mode: CruiseImportApplyMode) => {
      const overwriteDayIds = conflictDialog?.targetDayIds;
      setConflictDialog(null);
      if (mode === 'cancel') return;
      runApply(mode, mode === 'overwrite' ? overwriteDayIds : undefined).catch(() => undefined);
    },
    [conflictDialog, runApply]
  );

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
      {importReport ? (
        <CopyableReportModal
          title="Cruise import summary"
          body={importReport}
          onClose={() => setImportReport(null)}
        />
      ) : null}
      {conflictDialog ? (
        <CruiseImportConflictDialog
          affectedDayCount={conflictDialog.affectedDayCount}
          existingCount={conflictDialog.existingCount}
          onChoose={handleConflictChoice}
        />
      ) : null}
      {open ? (
        <div className={styles.panel} role="region" aria-label="Import cruise itinerary">
          <div className={styles.row}>
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
              <button type="button" className={styles.secondaryBtn} disabled={loading} onClick={() => setOpen(false)}>
                Cancel
              </button>
            </div>
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
                  <li key={`${r.date || 'd' + r.dayNumber}-${r.port}-${i}`}>
                    {r.date ? `${r.date} — ` : `Day ${r.dayNumber} — `}
                    {r.port} (Arrive {r.arrive || '—'}, Depart {r.depart || '—'})
                    {r.importNotes ? <div className={styles.previewNote}>{r.importNotes}</div> : null}
                  </li>
                ))}
              </ol>
              <div className={styles.actions}>
                <button
                  type="button"
                  className={styles.primaryBtn}
                  disabled={loading}
                  onClick={handleApplyClick}
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
