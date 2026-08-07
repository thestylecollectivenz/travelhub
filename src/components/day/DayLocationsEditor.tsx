import * as React from 'react';
import type { TripDay } from '../../models/TripDay';
import type { Place, PlaceCandidate } from '../../models/Place';
import { useTripWorkspace } from '../../context/TripWorkspaceContext';
import { usePlaces } from '../../context/PlacesContext';
import { useSpContext } from '../../context/SpContext';
import { syncLocationInfoCards } from '../../utils/locationInfoCardSync';
import { compareTripDaysChronological } from '../../utils/tripDateRangeSync';
import { parseAdditionalPlaceRefs, serializeAdditionalPlaceRef } from '../../utils/tripDayPlaces';
import { placeDisplayLabel } from '../../utils/placeDisplayLabel';
import { isTripHomePlace, toggleTripHomePlaceId } from '../../utils/tripHomePlaces';
import styles from './DayHeader.module.css';

export interface DayLocationsEditorProps {
  day: TripDay;
  /** Shared / read-only: no edits. */
  readOnly?: boolean;
  /** Hide the Done button (mobile sheet owns dismiss). */
  hideDone?: boolean;
  onDone?: () => void;
  activePlaceInfoId?: string;
  onActivePlaceInfoChange?: (placeId: string) => void;
}

export function locationsSummaryForDay(
  day: TripDay,
  placeById: (id: string) => Place | undefined
): string {
  const additionalRefs = parseAdditionalPlaceRefs(day.additionalPlaceIds);
  const primary = day.primaryPlaceId ? placeById(day.primaryPlaceId) : undefined;
  const count = (primary ? 1 : 0) + additionalRefs.length;
  if (!count) return 'No locations set';
  const primaryTitle = primary ? placeDisplayLabel(primary) : '';
  if (count === 1 && primaryTitle) return primaryTitle;
  if (primaryTitle) {
    const extra = count - 1;
    return extra > 0 ? `${primaryTitle} · +${extra} more` : primaryTitle;
  }
  return `${count} location${count === 1 ? '' : 's'}`;
}

export const DayLocationsEditor: React.FC<DayLocationsEditorProps> = ({
  day,
  readOnly = false,
  hideDone = false,
  onDone,
  activePlaceInfoId: controlledActivePlaceInfoId,
  onActivePlaceInfoChange
}) => {
  const { updateDay, updateTrip, reloadItineraryEntries, trip, tripDays, localEntries } = useTripWorkspace();
  const { searchPlaces, createOrReusePlace, placeById, ensurePlacesLoaded } = usePlaces();
  const spContext = useSpContext();
  const [locationSearch, setLocationSearch] = React.useState('');
  const [locationResults, setLocationResults] = React.useState<PlaceCandidate[]>([]);
  const [activePlaceInfoIdState, setActivePlaceInfoIdState] = React.useState('');
  const [copyDaysCount, setCopyDaysCount] = React.useState(1);
  const [locationMessage, setLocationMessage] = React.useState('');
  const additionalRefs = React.useMemo(() => parseAdditionalPlaceRefs(day.additionalPlaceIds), [day.additionalPlaceIds]);

  React.useEffect(() => {
    const ids = [day.primaryPlaceId, ...additionalRefs.map((ref) => ref.placeId)].filter(Boolean) as string[];
    if (ids.length > 0) {
      ensurePlacesLoaded(ids).catch(console.error);
    }
  }, [day.primaryPlaceId, additionalRefs, ensurePlacesLoaded]);

  const dayLocations = React.useMemo(() => {
    const primary = day.primaryPlaceId ? placeById(day.primaryPlaceId) : undefined;
    const additional = additionalRefs.map((ref) => {
      const p = placeById(ref.placeId);
      return { placeId: ref.placeId, place: p, returnToPrimary: ref.returnToPrimary };
    });
    return { primary, additional };
  }, [day.primaryPlaceId, additionalRefs, placeById]);

  const firstPlaceInfoId = dayLocations.primary?.id ?? dayLocations.additional[0]?.placeId ?? '';
  const activePlaceInfoId = controlledActivePlaceInfoId ?? activePlaceInfoIdState;
  const setActivePlaceInfoId = onActivePlaceInfoChange ?? setActivePlaceInfoIdState;

  React.useEffect(() => {
    setActivePlaceInfoId(firstPlaceInfoId);
  }, [day.id, firstPlaceInfoId, setActivePlaceInfoId]);

  const followingDayOptions = React.useMemo(() => {
    if (!trip || !dayLocations.primary) return [];
    const sorted = tripDays.filter((d) => d.tripId === trip.id).sort(compareTripDaysChronological);
    const idx = sorted.findIndex((d) => d.id === day.id);
    if (idx < 0) return [];
    let count = 0;
    for (let i = idx + 1; i < sorted.length; i++) {
      if (sorted[i].dayType === 'PreTrip') continue;
      count++;
    }
    const opts: number[] = [];
    for (let n = 1; n <= Math.min(count, 14); n++) opts.push(n);
    return opts;
  }, [trip, tripDays, day.id, dayLocations.primary]);

  React.useEffect(() => {
    if (followingDayOptions.length && followingDayOptions.indexOf(copyDaysCount) < 0) {
      setCopyDaysCount(followingDayOptions[0]);
    }
  }, [followingDayOptions, copyDaysCount]);

  React.useEffect(() => {
    if (!locationSearch.trim()) {
      setLocationResults([]);
      return;
    }
    const t = window.setTimeout(() => {
      searchPlaces(locationSearch)
        .then((rows) => setLocationResults(rows))
        .catch(console.error);
    }, 400);
    return () => window.clearTimeout(t);
  }, [locationSearch, searchPlaces]);

  React.useEffect(() => {
    if (!locationMessage) return undefined;
    const t = window.setTimeout(() => setLocationMessage(''), 1400);
    return () => window.clearTimeout(t);
  }, [locationMessage]);

  const applyPrimaryToFollowingDays = React.useCallback(
    (dayCount: number) => {
      if (!dayLocations.primary || !trip || dayCount < 1) return;
      const sorted = tripDays.filter((d) => d.tripId === trip.id).sort(compareTripDaysChronological);
      const idx = sorted.findIndex((d) => d.id === day.id);
      if (idx < 0) return;
      const additionalSerialized = dayLocations.additional.map((x) =>
        serializeAdditionalPlaceRef({ placeId: x.placeId, returnToPrimary: x.returnToPrimary })
      );
      const primaryId = dayLocations.primary.id;
      const patchedIds = new Set<string>();
      let applied = 0;
      for (let i = idx + 1; i < sorted.length && applied < dayCount; i++) {
        const next = sorted[i];
        if (next.dayType === 'PreTrip') continue;
        updateDay(next.id, {
          primaryPlaceId: primaryId,
          additionalPlaceIds: [...additionalSerialized]
        });
        patchedIds.add(next.id);
        applied++;
      }
      setLocationMessage(applied ? `Location copied to ${applied} following day${applied === 1 ? '' : 's'}` : 'No following days to update');
      if (!applied) return;
      const nextDays = tripDays.map((d) =>
        patchedIds.has(d.id)
          ? { ...d, primaryPlaceId: primaryId, additionalPlaceIds: [...additionalSerialized] }
          : d
      );
      void syncLocationInfoCards({
        spContext,
        tripId: trip.id,
        tripDays: nextDays,
        entries: localEntries,
        placeById,
        onCardsCreated: () => reloadItineraryEntries()
      })
        .then(() => reloadItineraryEntries())
        .catch(console.error);
    },
    [
      day.id,
      dayLocations,
      trip,
      tripDays,
      updateDay,
      spContext,
      localEntries,
      placeById,
      reloadItineraryEntries
    ]
  );

  const updateLocations = React.useCallback(
    (
      primaryId: string,
      additional: Array<{ placeId: string; returnToPrimary: boolean }>,
      knownPlaces?: Place[]
    ) => {
      const additionalPlaceIds = additional.map((x) => serializeAdditionalPlaceRef(x));
      updateDay(day.id, {
        primaryPlaceId: primaryId || '',
        additionalPlaceIds
      });
      if (!trip?.id) return;
      // Use the pending day state — React tripDays is still stale until the next render.
      const nextDays = tripDays.map((d) =>
        d.id === day.id
          ? {
              ...d,
              primaryPlaceId: primaryId || '',
              additionalPlaceIds
            }
          : d
      );
      // Newly created places may not be in PlacesContext state yet (setState is async).
      const lookup = (id?: string): Place | undefined => {
        if (!id) return undefined;
        const known = knownPlaces?.find((p) => p.id === id);
        return known ?? placeById(id);
      };
      void syncLocationInfoCards({
        spContext,
        tripId: trip.id,
        tripDays: nextDays,
        entries: localEntries,
        placeById: lookup,
        onCardsCreated: () => reloadItineraryEntries()
      })
        .then(() => reloadItineraryEntries())
        .catch(console.error);
    },
    [day.id, updateDay, reloadItineraryEntries, trip?.id, tripDays, localEntries, spContext, placeById]
  );

  const clearSearch = (): void => {
    setLocationSearch('');
    setLocationResults([]);
  };

  return (
    <section className={styles.locationsColumn}>
      <div className={styles.locationsPanel}>
        <div className={styles.locationsPanelHead}>
          <span className={styles.locationsPanelTitle}>Day locations</span>
          <span className={styles.locationsPanelHint}>Changes save automatically</span>
          {!hideDone ? (
            <button
              type="button"
              className={styles.locationsDoneBtn}
              onClick={() => {
                clearSearch();
                onDone?.();
              }}
            >
              Done
            </button>
          ) : null}
        </div>
        <div className={styles.placeSection}>
          {!readOnly ? (
            <div className={styles.searchWrap}>
              <input
                className={styles.placeInput}
                value={locationSearch}
                onChange={(e) => setLocationSearch(e.target.value)}
                placeholder="Add location"
              />
              {locationResults.length ? (
                <div className={styles.searchDropdown}>
                  {locationResults.map((p) => (
                    <button
                      key={p.nominatimId}
                      type="button"
                      className={styles.searchOption}
                      onClick={() => {
                        createOrReusePlace(p)
                          .then((saved) => {
                            const existingIds = [
                              ...(dayLocations.primary ? [dayLocations.primary.id] : []),
                              ...dayLocations.additional.map((x) => x.placeId)
                            ];
                            const alreadyById = existingIds.indexOf(saved.id) >= 0;
                            const placeRows = dayLocations.primary
                              ? [dayLocations.primary, ...dayLocations.additional.map((x) => x.place)]
                              : dayLocations.additional.map((x) => x.place);
                            const alreadyByTitle = placeRows.some(
                              (x) => (x?.title || '').trim().toLowerCase() === (saved.title || '').trim().toLowerCase()
                            );
                            const alreadyByNominatim =
                              Boolean(saved.nominatimId || '') &&
                              placeRows.some((x) => (x?.nominatimId || '') === saved.nominatimId);
                            if (alreadyById || alreadyByTitle || alreadyByNominatim) {
                              setLocationMessage('Already added');
                              clearSearch();
                              return;
                            }
                            if (!dayLocations.primary) {
                              updateLocations(
                                saved.id,
                                dayLocations.additional.map((x) => ({
                                  placeId: x.placeId,
                                  returnToPrimary: x.returnToPrimary
                                })),
                                [saved]
                              );
                            } else {
                              updateLocations(
                                dayLocations.primary.id,
                                [
                                  ...dayLocations.additional.map((x) => ({
                                    placeId: x.placeId,
                                    returnToPrimary: x.returnToPrimary
                                  })),
                                  { placeId: saved.id, returnToPrimary: true }
                                ],
                                [saved]
                              );
                            }
                            clearSearch();
                          })
                          .catch(console.error);
                      }}
                    >
                      <span>{placeDisplayLabel(p)}</span>
                    </button>
                  ))}
                </div>
              ) : null}
            </div>
          ) : null}
          <div className={styles.additionalList}>
            {(
              [
                ...(dayLocations.primary
                  ? [
                      {
                        placeId: dayLocations.primary.id,
                        place: dayLocations.primary as Place | undefined,
                        primary: true,
                        returnToPrimary: true
                      }
                    ]
                  : []),
                ...dayLocations.additional.map((a) => ({
                  placeId: a.placeId,
                  place: a.place,
                  primary: false as const,
                  returnToPrimary: a.returnToPrimary
                }))
              ] as Array<{ placeId: string; place: Place | undefined; primary: boolean; returnToPrimary: boolean }>
            ).map((row, idx) => {
              const isInfoTarget = row.place ? activePlaceInfoId === row.place.id : activePlaceInfoId === row.placeId;
              const placeLabel = row.place ? placeDisplayLabel(row.place) : 'Loading place…';
              return (
                <div
                  key={row.placeId}
                  className={`${styles.locationRow} ${isInfoTarget ? styles.locationRowActive : ''}`}
                >
                  <div className={styles.locationRowHead}>
                    <button
                      type="button"
                      className={styles.locationSelectBtn}
                      onClick={() => setActivePlaceInfoId(row.place?.id ?? row.placeId)}
                      aria-pressed={isInfoTarget}
                      disabled={!row.place}
                    >
                      <span className={styles.placePill}>
                        <span aria-hidden>📍</span> {placeLabel}
                        {row.primary ? <span className={styles.placeMeta}>Primary</span> : null}
                        {isTripHomePlace(trip, row.placeId) ? (
                          <span className={styles.placeMeta}>Home</span>
                        ) : null}
                      </span>
                    </button>
                    {!readOnly && row.place ? (
                      <div className={styles.locationInlineActions}>
                        <button
                          type="button"
                          className={styles.iconActionBtn}
                          onClick={() => {
                            const next = toggleTripHomePlaceId(trip?.homePlaceIds, row.placeId);
                            updateTrip({ homePlaceIds: next });
                            setLocationMessage(
                              next.includes(row.placeId)
                                ? 'Marked as home location'
                                : 'Removed from home locations'
                            );
                          }}
                          title={
                            isTripHomePlace(trip, row.placeId)
                              ? 'Remove from home locations (AI ideas)'
                              : 'Mark as home (excluded from AI ideas)'
                          }
                        >
                          {isTripHomePlace(trip, row.placeId) ? '⌂✓' : '⌂'}
                        </button>
                        {!row.primary ? (
                          <button
                            type="button"
                            className={styles.iconActionBtn}
                            onClick={() => {
                              const list = dayLocations.additional.map((x) => ({ ...x }));
                              const addIdx = idx - 1;
                              if (addIdx < 0) return;
                              list[addIdx] = { ...list[addIdx], returnToPrimary: !list[addIdx].returnToPrimary };
                              updateLocations(
                                dayLocations.primary?.id ?? '',
                                list.map((x) => ({ placeId: x.placeId, returnToPrimary: x.returnToPrimary }))
                              );
                            }}
                            title={`Return to primary: ${row.returnToPrimary ? 'Yes' : 'No'}`}
                          >
                            ↩
                          </button>
                        ) : null}
                        {!row.primary ? (
                          <button
                            type="button"
                            className={styles.iconActionBtn}
                            onClick={() => {
                              const addIdx = idx - 1;
                              if (addIdx < 0 || !dayLocations.primary) return;
                              const nextPrimary = dayLocations.additional[addIdx];
                              const remaining = dayLocations.additional
                                .filter((_, i) => i !== addIdx)
                                .map((x) => ({ ...x }));
                              remaining.unshift({
                                placeId: dayLocations.primary.id,
                                place: dayLocations.primary,
                                returnToPrimary: true
                              });
                              updateLocations(
                                nextPrimary.placeId,
                                remaining.map((x) => ({ placeId: x.placeId, returnToPrimary: x.returnToPrimary }))
                              );
                            }}
                            title="Set as primary"
                          >
                            ★
                          </button>
                        ) : null}
                        <button
                          type="button"
                          className={styles.iconActionBtn}
                          onClick={() => {
                            if (row.primary) {
                              const firstAdditional = dayLocations.additional[0];
                              if (!firstAdditional) {
                                updateLocations('', []);
                                return;
                              }
                              if (!firstAdditional?.place) return;
                              updateLocations(
                                firstAdditional.placeId,
                                dayLocations.additional
                                  .slice(1)
                                  .map((x) => ({ placeId: x.placeId, returnToPrimary: x.returnToPrimary }))
                              );
                            } else {
                              const addIdx = idx - 1;
                              updateLocations(
                                dayLocations.primary?.id ?? '',
                                dayLocations.additional
                                  .filter((_, i) => i !== addIdx)
                                  .map((x) => ({ placeId: x.placeId, returnToPrimary: x.returnToPrimary }))
                              );
                            }
                          }}
                          title="Remove location"
                        >
                          ×
                        </button>
                        <button
                          type="button"
                          className={styles.iconActionBtn}
                          disabled={idx === 0}
                          onClick={() => {
                            if (idx === 0) return;
                            const rows = dayLocations.additional.map((x) => ({ ...x }));
                            const current = idx - 1;
                            const prior = current - 1;
                            if (current < 0 || prior < 0 || !dayLocations.primary) return;
                            const temp = rows[prior];
                            rows[prior] = rows[current];
                            rows[current] = temp;
                            updateLocations(
                              dayLocations.primary.id,
                              rows.map((x) => ({ placeId: x.placeId, returnToPrimary: x.returnToPrimary }))
                            );
                          }}
                          title="Move up"
                        >
                          ↑
                        </button>
                        <button
                          type="button"
                          className={styles.iconActionBtn}
                          disabled={idx === 0 || idx >= dayLocations.additional.length}
                          onClick={() => {
                            const rows = dayLocations.additional.map((x) => ({ ...x }));
                            const current = idx - 1;
                            if (current < 0 || current >= rows.length - 1 || !dayLocations.primary) return;
                            const temp = rows[current + 1];
                            rows[current + 1] = rows[current];
                            rows[current] = temp;
                            updateLocations(
                              dayLocations.primary.id,
                              rows.map((x) => ({ placeId: x.placeId, returnToPrimary: x.returnToPrimary }))
                            );
                          }}
                          title="Move down"
                        >
                          ↓
                        </button>
                      </div>
                    ) : null}
                    {row.place ? (
                      <div className={styles.locationLinkGroup}>
                        <button
                          type="button"
                          className={`${styles.locationInfoBtn} ${isInfoTarget ? styles.locationInfoBtnActive : ''}`}
                          onClick={() => setActivePlaceInfoId(row.place!.id)}
                        >
                          Place info
                        </button>
                        <a
                          className={styles.locationMapsBtn}
                          href={`https://www.google.com/maps/@${row.place.latitude},${row.place.longitude},10z`}
                          target="_blank"
                          rel="noopener noreferrer"
                        >
                          Map
                        </a>
                      </div>
                    ) : null}
                  </div>
                  {!readOnly && row.primary && followingDayOptions.length ? (
                    <div className={styles.locationCopyRow}>
                      <span className={styles.infoSub}>Same location for next</span>
                      <select
                        className={styles.copyLocationSelect}
                        value={copyDaysCount}
                        onChange={(e) => setCopyDaysCount(Number(e.target.value))}
                        aria-label="Number of following days"
                      >
                        {followingDayOptions.map((n) => (
                          <option key={n} value={n}>
                            {n} day{n === 1 ? '' : 's'}
                          </option>
                        ))}
                      </select>
                      <button
                        type="button"
                        className={styles.clearPlaceBtn}
                        onClick={() => applyPrimaryToFollowingDays(copyDaysCount)}
                      >
                        Apply
                      </button>
                    </div>
                  ) : null}
                </div>
              );
            })}
          </div>
          {locationMessage ? <div className={styles.infoSub}>{locationMessage}</div> : null}
        </div>
      </div>
    </section>
  );
};
