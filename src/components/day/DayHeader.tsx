import * as React from 'react';
import type { TripDay } from '../../models/TripDay';
import { useConfig } from '../../context/ConfigContext';
import { useTripWorkspace } from '../../context/TripWorkspaceContext';
import { usePlaces } from '../../context/PlacesContext';
import { useSpContext } from '../../context/SpContext';
import { syncLocationInfoCards } from '../../utils/locationInfoCardSync';
import type { Place, PlaceCandidate } from '../../models/Place';
import { formatDayDate } from '../../utils/dateUtils';
import { compareTripDaysChronological } from '../../utils/tripDateRangeSync';
import { parseAdditionalPlaceRefs, serializeAdditionalPlaceRef } from '../../utils/tripDayPlaces';
import { placeDisplayLabel } from '../../utils/placeDisplayLabel';
import type { DayPlanningStatus } from '../../models/TripDay';
import styles from './DayHeader.module.css';

export interface DayHeaderProps {
  day: TripDay;
  /** Shared / read-only: no inline edits. */
  variant?: 'default' | 'shared';
  /** When true, only the day title row stays sticky while scrolling (not locations or place info). */
  stickyTitleOnly?: boolean;
  activePlaceInfoId?: string;
  onActivePlaceInfoChange?: (placeId: string) => void;
}

function dayTypeLabel(dayType: TripDay['dayType']): string {
  switch (dayType) {
    case 'Sea':
      return 'Sea day';
    case 'TravelTransit':
      return 'Transit';
    case 'PreTrip':
      return 'Pre-trip';
    case 'PlacePort':
    default:
      return 'Place / Port';
  }
}

export const DayHeader: React.FC<DayHeaderProps> = ({
  day,
  variant = 'default',
  stickyTitleOnly = false,
  activePlaceInfoId: controlledActivePlaceInfoId,
  onActivePlaceInfoChange
}) => {
  const { updateDay, reloadItineraryEntries, trip, tripDays, localEntries } = useTripWorkspace();
  const { config } = useConfig();
  const { searchPlaces, createOrReusePlace, placeById, ensurePlacesLoaded } = usePlaces();
  const spContext = useSpContext();
  const isShared = variant === 'shared';
  const [isEditingTitle, setIsEditingTitle] = React.useState(false);
  const [titleDraft, setTitleDraft] = React.useState(day.displayTitle);
  const [typePickerOpen, setTypePickerOpen] = React.useState(false);
  const [locationSearch, setLocationSearch] = React.useState('');
  const [locationResults, setLocationResults] = React.useState<PlaceCandidate[]>([]);
  const [locationsExpanded, setLocationsExpanded] = React.useState(false);
  const [activePlaceInfoIdState, setActivePlaceInfoIdState] = React.useState('');
  const [copyDaysCount, setCopyDaysCount] = React.useState(1);
  const [locationMessage, setLocationMessage] = React.useState('');
  const planningStatus: DayPlanningStatus = day.planningStatus ?? 'NotStarted';
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

  const locationsSummary = React.useMemo(() => {
    const count = (dayLocations.primary ? 1 : 0) + dayLocations.additional.length;
    if (!count) return 'No locations set';
    const primaryTitle = dayLocations.primary ? placeDisplayLabel(dayLocations.primary) : '';
    if (count === 1 && primaryTitle) return primaryTitle;
    if (primaryTitle) {
      const extra = count - 1;
      return extra > 0 ? `${primaryTitle} · +${extra} more` : primaryTitle;
    }
    return `${count} location${count === 1 ? '' : 's'}`;
  }, [dayLocations]);

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
    setTitleDraft(day.displayTitle);
  }, [day.displayTitle]);

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
      let applied = 0;
      for (let i = idx + 1; i < sorted.length && applied < dayCount; i++) {
        const next = sorted[i];
        if (next.dayType === 'PreTrip') continue;
        updateDay(next.id, {
          primaryPlaceId: dayLocations.primary!.id,
          additionalPlaceIds: [...additionalSerialized]
        });
        applied++;
      }
      setLocationMessage(applied ? `Location copied to ${applied} following day${applied === 1 ? '' : 's'}` : 'No following days to update');
    },
    [day.id, dayLocations, trip, tripDays, updateDay]
  );

  const updateLocations = React.useCallback(
    (primaryId: string, additional: Array<{ placeId: string; returnToPrimary: boolean }>) => {
      updateDay(day.id, {
        primaryPlaceId: primaryId || '',
        additionalPlaceIds: additional.map((x) => serializeAdditionalPlaceRef(x))
      });
      if (!trip?.id) return;
      void syncLocationInfoCards({
        spContext,
        tripId: trip.id,
        tripDays,
        entries: localEntries,
        placeById,
        geminiApiKey: config.geminiApiKey,
        onCardsCreated: () => reloadItineraryEntries()
      })
        .then(() => reloadItineraryEntries())
        .catch(console.error);
    },
    [day.id, updateDay, reloadItineraryEntries, trip?.id, tripDays, localEntries, spContext, placeById, config.geminiApiKey]
  );

  const saveTitle = React.useCallback(() => {
    const next = titleDraft.trim();
    if (!next || next === day.displayTitle) {
      setTitleDraft(day.displayTitle);
      setIsEditingTitle(false);
      return;
    }
    updateDay(day.id, { displayTitle: next });
    setIsEditingTitle(false);
  }, [day.displayTitle, day.id, titleDraft, updateDay]);

  const cancelTitle = React.useCallback(() => {
    setTitleDraft(day.displayTitle);
    setIsEditingTitle(false);
  }, [day.displayTitle]);

  const dayTypeClass =
    day.dayType === 'PreTrip'
      ? styles.badgePreTrip
      : day.dayType === 'Sea'
        ? styles.badgeSea
        : day.dayType === 'TravelTransit'
          ? styles.badgeTransit
          : styles.badgePlacePort;

  return (
    <header className={`${styles.bar} ${stickyTitleOnly ? styles.barLocationsOnly : ''}`}>
      {stickyTitleOnly ? null : (
      <div className={styles.titleBlock}>
        <div className={styles.line1}>
          <span className={styles.dayNumber}>Day {day.dayNumber}</span>
          {isShared ? (
            <span className={styles.titleReadonly}>{day.displayTitle}</span>
          ) : isEditingTitle ? (
            <input
              className={styles.titleInput}
              value={titleDraft}
              onChange={(e) => setTitleDraft(e.target.value)}
              onBlur={saveTitle}
              onKeyDown={(e) => {
                if (e.key === 'Enter') saveTitle();
                if (e.key === 'Escape') cancelTitle();
              }}
              autoFocus
            />
          ) : (
            <button type="button" className={styles.titleButton} onClick={() => setIsEditingTitle(true)}>
              {day.displayTitle}
            </button>
          )}
          <div className={styles.dayTypeWrap}>
            {isShared ? (
              <span className={`${styles.dayTypeBadge} ${dayTypeClass}`}>{dayTypeLabel(day.dayType)}</span>
            ) : (
              <>
                <button type="button" className={`${styles.dayTypeBadge} ${dayTypeClass}`} onClick={() => setTypePickerOpen((v) => !v)}>
                  {dayTypeLabel(day.dayType)}
                </button>
                {typePickerOpen ? (
                  <div className={styles.dayTypeOptions}>
                    {(['PlacePort', 'Sea', 'TravelTransit', 'PreTrip'] as const).map((option) => (
                      <button
                        key={option}
                        type="button"
                        className={`${styles.dayTypeOption} ${
                          option === 'PreTrip'
                            ? styles.badgePreTrip
                            : option === 'Sea'
                              ? styles.badgeSea
                              : option === 'TravelTransit'
                                ? styles.badgeTransit
                                : styles.badgePlacePort
                        }`}
                        onClick={() => {
                          updateDay(day.id, { dayType: option });
                          setTypePickerOpen(false);
                        }}
                      >
                        {dayTypeLabel(option)}
                      </button>
                    ))}
                  </div>
                ) : null}
              </>
            )}
          </div>
          {!stickyTitleOnly ? (
            <div className={styles.line1Right}>
              <button
                type="button"
                className={styles.locationsInlineBtn}
                onClick={() => setLocationsExpanded((v) => !v)}
                aria-expanded={locationsExpanded}
              >
                <span className={styles.locationsInlineLabel}>Locations</span>
                <span className={styles.locationsInlineSummary}>{locationsSummary}</span>
              </button>
            </div>
          ) : null}
        </div>
        <div className={styles.date}>
          {day.dayType === 'PreTrip' ? 'Before trip starts' : formatDayDate(day.calendarDate)}
        </div>
        {!isShared && trip?.id ? (
          <label className={styles.planningRow}>
            Day planning
            <select
              className={styles.planningSelect}
              value={planningStatus}
              onChange={(e) => {
                updateDay(day.id, { planningStatus: e.target.value as DayPlanningStatus });
              }}
            >
              <option value="NotStarted">Not started</option>
              <option value="InProgress">In progress</option>
              <option value="Complete">Complete</option>
            </select>
          </label>
        ) : null}
      </div>
      )}
      {locationsExpanded ? (
      <section className={styles.locationsColumn}>
        <div className={styles.locationsPanel}>
        <div className={styles.placeSection}>
          {!isShared ? (
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
                        createOrReusePlace(p).then((saved) => {
                          const existingIds = [
                            ...(dayLocations.primary ? [dayLocations.primary.id] : []),
                            ...dayLocations.additional.map((x) => x.placeId)
                          ];
                          const alreadyById = existingIds.indexOf(saved.id) >= 0;
                          const alreadyByTitle =
                            (dayLocations.primary ? [dayLocations.primary, ...dayLocations.additional.map((x) => x.place)] : dayLocations.additional.map((x) => x.place))
                              .some((x) => (x?.title || '').trim().toLowerCase() === (saved.title || '').trim().toLowerCase());
                          if (
                            alreadyById ||
                            alreadyByTitle ||
                            ((saved.nominatimId || '') &&
                              (dayLocations.primary ? [dayLocations.primary, ...dayLocations.additional.map((x) => x.place)] : dayLocations.additional.map((x) => x.place))
                                .some((x) => (x?.nominatimId || '') === saved.nominatimId))
                          ) {
                            setLocationMessage('Already added');
                            setLocationSearch('');
                            setLocationResults([]);
                            return;
                          }
                          if (!dayLocations.primary) {
                            updateLocations(saved.id, dayLocations.additional.map((x) => ({ placeId: x.placeId, returnToPrimary: x.returnToPrimary })));
                          } else {
                            updateLocations(dayLocations.primary.id, [
                              ...dayLocations.additional.map((x) => ({ placeId: x.placeId, returnToPrimary: x.returnToPrimary })),
                              { placeId: saved.id, returnToPrimary: true }
                            ]);
                          }
                          setLocationSearch('');
                          setLocationResults([]);
                        }).catch(console.error);
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
                  ? [{ placeId: dayLocations.primary.id, place: dayLocations.primary as Place | undefined, primary: true, returnToPrimary: true }]
                  : []),
                ...dayLocations.additional.map((a) => ({
                  placeId: a.placeId,
                  place: a.place,
                  primary: false as const,
                  returnToPrimary: a.returnToPrimary
                }))
              ] as Array<{ placeId: string; place: Place | undefined; primary: boolean; returnToPrimary: boolean }>
            )
              .map((row, idx) => {
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
                    </span>
                  </button>
                  {!isShared && row.place ? (
                    <div className={styles.locationInlineActions}>
                        {!row.primary ? (
                          <button
                            type="button"
                            className={styles.iconActionBtn}
                            onClick={() => {
                              const list = dayLocations.additional.map((x) => ({ ...x }));
                              const addIdx = idx - 1;
                              if (addIdx < 0) return;
                              list[addIdx] = { ...list[addIdx], returnToPrimary: !list[addIdx].returnToPrimary };
                              updateLocations(dayLocations.primary?.id ?? '', list.map((x) => ({ placeId: x.placeId, returnToPrimary: x.returnToPrimary })));
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
                              remaining.unshift({ placeId: dayLocations.primary.id, place: dayLocations.primary, returnToPrimary: true });
                              updateLocations(nextPrimary.placeId, remaining.map((x) => ({ placeId: x.placeId, returnToPrimary: x.returnToPrimary })));
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
                                dayLocations.additional.slice(1).map((x) => ({ placeId: x.placeId, returnToPrimary: x.returnToPrimary }))
                              );
                            } else {
                              const addIdx = idx - 1;
                              updateLocations(
                                dayLocations.primary?.id ?? '',
                                dayLocations.additional.filter((_, i) => i !== addIdx).map((x) => ({ placeId: x.placeId, returnToPrimary: x.returnToPrimary }))
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
                            updateLocations(dayLocations.primary.id, rows.map((x) => ({ placeId: x.placeId, returnToPrimary: x.returnToPrimary })));
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
                            updateLocations(dayLocations.primary.id, rows.map((x) => ({ placeId: x.placeId, returnToPrimary: x.returnToPrimary })));
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
                {!isShared && row.primary && followingDayOptions.length ? (
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
      ) : null}
    </header>
  );
};
