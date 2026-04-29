import * as React from 'react';
import type { TripDay } from '../../models/TripDay';
import { useConfig } from '../../context/ConfigContext';
import { useTripWorkspace } from '../../context/TripWorkspaceContext';
import { usePlaces } from '../../context/PlacesContext';
import type { PlaceCandidate } from '../../models/Place';
import { COUNTRY_DATA } from '../../data/countryData';
import { SEASONAL_BY_REGION } from '../../data/seasonalWeather';
import { formatDayDate } from '../../utils/dateUtils';
import { formatCurrency } from '../../utils/financialUtils';
import { parseAdditionalPlaceRefs, serializeAdditionalPlaceRef } from '../../utils/tripDayPlaces';
import { TipCalculator } from '../utilities/TipCalculator';
import styles from './DayHeader.module.css';

export interface DayHeaderProps {
  day: TripDay;
  dayTotal: number;
  onAddEntry: () => void;
  onWriteJournal?: () => void;
  /** Shared / read-only: no totals, no add, no inline edits. */
  variant?: 'default' | 'shared';
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

function WeatherIcon({ iconCode }: { iconCode: string }): React.ReactElement {
  const code = (iconCode || '').toLowerCase();
  if (code.includes('clear-night')) {
    return (
      <svg viewBox="0 0 16 16" width={14} height={14} aria-hidden>
        <path d="M10.8 2.2a5.2 5.2 0 1 0 3 8.7 5 5 0 1 1-3-8.7Z" fill="var(--color-blue-400)" />
      </svg>
    );
  }
  if (code.includes('clear-day')) {
    return (
      <svg viewBox="0 0 16 16" width={14} height={14} aria-hidden>
        <circle cx="8" cy="8" r="3.2" fill="var(--color-amber-400)" />
        <path d="M8 1.5v2M8 12.5v2M1.5 8h2M12.5 8h2M3 3l1.4 1.4M11.6 11.6 13 13M3 13l1.4-1.4M11.6 4.4 13 3" stroke="var(--color-amber-400)" strokeWidth="1.2" />
      </svg>
    );
  }
  if (code.includes('partly-cloudy')) {
    return (
      <svg viewBox="0 0 16 16" width={14} height={14} aria-hidden>
        <circle cx="6" cy="6" r="2.4" fill="var(--color-amber-400)" />
        <path d="M6.2 12.5h5.1a2 2 0 0 0 0-4 2.8 2.8 0 0 0-5.2-.8A2 2 0 0 0 6.2 12.5Z" fill="var(--color-blue-200)" />
      </svg>
    );
  }
  if (code.includes('cloud')) {
    return (
      <svg viewBox="0 0 16 16" width={14} height={14} aria-hidden>
        <path d="M4.3 12h7.2a2.4 2.4 0 0 0 0-4.8A3.3 3.3 0 0 0 5 6 2.8 2.8 0 0 0 4.3 12Z" fill="var(--color-blue-200)" />
      </svg>
    );
  }
  if (code.includes('rain')) {
    return (
      <svg viewBox="0 0 16 16" width={14} height={14} aria-hidden>
        <path d="M4.3 9h7.2a2.4 2.4 0 0 0 0-4.8A3.3 3.3 0 0 0 5 3 2.8 2.8 0 0 0 4.3 9Z" fill="var(--color-blue-200)" />
        <path d="M6 10.5 5.4 12M8.2 10.5 7.6 12M10.4 10.5 9.8 12" stroke="var(--color-blue-400)" strokeWidth="1.2" strokeLinecap="round" />
      </svg>
    );
  }
  if (code.includes('snow')) {
    return (
      <svg viewBox="0 0 16 16" width={14} height={14} aria-hidden>
        <path d="M8 3.5v9M4.5 5.5l7 5M11.5 5.5l-7 5" stroke="var(--color-blue-200)" strokeWidth="1.2" strokeLinecap="round" />
      </svg>
    );
  }
  if (code.includes('thunder')) {
    return (
      <svg viewBox="0 0 16 16" width={14} height={14} aria-hidden>
        <path d="M7.2 2.5 4.8 8h2.4L5.7 13.5 11.2 7.2H8.7L10.2 2.5Z" fill="var(--color-amber-400)" />
      </svg>
    );
  }
  return (
    <svg viewBox="0 0 16 16" width={14} height={14} aria-hidden>
      <path d="M3.5 5.5h9M2.8 8h10.4M3.5 10.5h9" stroke="var(--color-sand-400)" strokeWidth="1.2" strokeLinecap="round" />
    </svg>
  );
}

export const DayHeader: React.FC<DayHeaderProps> = ({ day, dayTotal, onAddEntry, onWriteJournal, variant = 'default' }) => {
  const { config } = useConfig();
  const { updateDay, trip } = useTripWorkspace();
  const { searchPlaces, createOrReusePlace, placeById } = usePlaces();
  const isShared = variant === 'shared';
  const [isEditingTitle, setIsEditingTitle] = React.useState(false);
  const [titleDraft, setTitleDraft] = React.useState(day.displayTitle);
  const [typePickerOpen, setTypePickerOpen] = React.useState(false);
  const [locationSearch, setLocationSearch] = React.useState('');
  const [locationResults, setLocationResults] = React.useState<PlaceCandidate[]>([]);
  const [placeInfoOpen, setPlaceInfoOpen] = React.useState(true);
  const [weather, setWeather] = React.useState<{
    temp: number;
    description: string;
    iconCode: string;
    sunrise: number;
    sunset: number;
    timezoneName: string;
  } | null>(null);
  const [typicalWeather, setTypicalWeather] = React.useState<{
    tempRange: string;
    conditions: string;
    sunrise: string;
    sunset: string;
  } | null>(null);
  const [locationMessage, setLocationMessage] = React.useState('');
  const [tipOpen, setTipOpen] = React.useState(false);

  const additionalRefs = React.useMemo(() => parseAdditionalPlaceRefs(day.additionalPlaceIds), [day.additionalPlaceIds]);
  const dayLocations = React.useMemo(() => {
    const primary = day.primaryPlaceId ? placeById(day.primaryPlaceId) : undefined;
    const additional = additionalRefs
      .map((ref) => {
        const p = placeById(ref.placeId);
        if (!p) return undefined;
        return { placeId: ref.placeId, place: p, returnToPrimary: ref.returnToPrimary };
      })
      .filter(Boolean) as Array<{ placeId: string; place: NonNullable<ReturnType<typeof placeById>>; returnToPrimary: boolean }>;
    return { primary, additional };
  }, [day.primaryPlaceId, additionalRefs, placeById]);
  const infoPlace = dayLocations.primary;
  const countryData = infoPlace ? COUNTRY_DATA[infoPlace.countryCode] : undefined;
  const weatherAnchorDate =
    day.dayType === 'PreTrip' && trip?.dateStart ? trip.dateStart.split('T')[0] : day.calendarDate;

  const monthIndex = React.useMemo(() => {
    const d = new Date(`${weatherAnchorDate}T00:00:00.000Z`);
    return Number.isNaN(d.getTime()) ? 0 : d.getUTCMonth();
  }, [weatherAnchorDate]);
  const seasonal = React.useMemo(() => {
    if (!countryData) return undefined;
    return SEASONAL_BY_REGION[countryData.region]?.[monthIndex];
  }, [countryData, monthIndex]);

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
    if (!placeInfoOpen || !infoPlace || !config.weatherApiKey.trim()) {
      setWeather(null);
      return;
    }
    const units = config.temperatureUnit === 'Fahrenheit' ? 'us' : 'metric';
    const url = `https://weather.visualcrossing.com/VisualCrossingWebServices/rest/services/timeline/${infoPlace.latitude},${infoPlace.longitude}?key=${encodeURIComponent(config.weatherApiKey.trim())}&unitGroup=${units}&include=current,days&contentType=json`;
    fetch(url)
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error(`Weather ${r.status}`))))
      .then((data) => {
        const current = data.currentConditions ?? {};
        setWeather({
          temp: Number(current.temp ?? 0),
          description: String(current.conditions ?? ''),
          iconCode: String(current.icon ?? ''),
          sunrise: Number(current.sunriseEpoch ?? 0),
          sunset: Number(current.sunsetEpoch ?? 0),
          timezoneName: String(data.timezone ?? '')
        });
      })
      .catch(() => {
        setWeather(null);
      });
  }, [placeInfoOpen, infoPlace, config.temperatureUnit, config.weatherApiKey]);
  React.useEffect(() => {
    if (!placeInfoOpen || !infoPlace) {
      setTypicalWeather(null);
      return;
    }
    if (!config.weatherApiKey.trim()) {
      setTypicalWeather(null);
      return;
    }
    const units = config.temperatureUnit === 'Fahrenheit' ? 'us' : 'metric';
    const date = weatherAnchorDate;
    const url = `https://weather.visualcrossing.com/VisualCrossingWebServices/rest/services/timeline/${infoPlace.latitude},${infoPlace.longitude}/${date}?key=${encodeURIComponent(config.weatherApiKey.trim())}&include=days&elements=tempmax,tempmin,sunrise,sunset,conditions&unitGroup=${units}&contentType=json`;
    fetch(url)
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error(`Weather ${r.status}`))))
      .then((data) => {
        const d = (data.days ?? [])[0] ?? {};
        setTypicalWeather({
          tempRange: `${Math.round(Number(d.tempmin ?? 0))}° to ${Math.round(Number(d.tempmax ?? 0))}°${config.temperatureUnit === 'Fahrenheit' ? 'F' : 'C'}`,
          conditions: String(d.conditions ?? 'Typical conditions unavailable'),
          sunrise: String(d.sunrise ?? '—'),
          sunset: String(d.sunset ?? '—')
        });
      })
      .catch(() => setTypicalWeather(null));
  }, [placeInfoOpen, infoPlace, config.weatherApiKey, config.temperatureUnit, weatherAnchorDate]);
  React.useEffect(() => {
    if (!locationMessage) return undefined;
    const t = window.setTimeout(() => setLocationMessage(''), 1400);
    return () => window.clearTimeout(t);
  }, [locationMessage]);

  const formatLocalFromUnix = React.useCallback((unix: number, tzName: string): string => {
    if (!unix) return '—';
    const d = new Date(unix * 1000);
    return d.toLocaleTimeString('en-NZ', { hour: '2-digit', minute: '2-digit', hour12: false, timeZone: tzName || undefined });
  }, []);
  const hhmmOnly = React.useCallback((value: string): string => {
    if (!value) return '—';
    const parts = value.split(':');
    if (parts.length < 2) return value;
    return `${parts[0]}:${parts[1]}`;
  }, []);

  const updateLocations = React.useCallback(
    (primaryId: string, additional: Array<{ placeId: string; returnToPrimary: boolean }>) => {
      updateDay(day.id, {
        primaryPlaceId: primaryId || '',
        additionalPlaceIds: additional.map((x) => serializeAdditionalPlaceRef(x))
      });
    },
    [day.id, updateDay]
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
    <header className={styles.bar}>
      <div className={styles.left}>
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
        </div>
        <div className={styles.date}>
          {day.dayType === 'PreTrip' ? 'Before trip starts' : formatDayDate(day.calendarDate)}
        </div>
        <div className={styles.placeSection}>
          <div className={styles.alsoVisiting}>Locations</div>
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
                            ...dayLocations.additional.map((x) => x.place.id)
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
                      <span>{p.title}</span>
                      <span className={styles.searchMeta}>{p.country}</span>
                    </button>
                  ))}
                </div>
              ) : null}
            </div>
          ) : null}
          <div className={styles.additionalList}>
            {(dayLocations.primary ? [{ place: dayLocations.primary, primary: true, returnToPrimary: true }] : [])
              .concat(dayLocations.additional.map((a) => ({ place: a.place, primary: false, returnToPrimary: a.returnToPrimary })))
              .map((row, idx) => (
              <span key={row.place.id} className={styles.additionalRow}>
                <span className={styles.placePill}>
                  <span aria-hidden>📍</span> {row.place.title}
                  {row.primary ? <span className={styles.placeMeta}>Primary</span> : null}
                  {isShared ? null : (
                    <>
                      {!row.primary ? (
                        <button
                          type="button"
                          className={styles.clearPlaceBtn}
                          onClick={() => {
                            const list = dayLocations.additional.map((x) => ({ ...x }));
                            const addIdx = idx - 1;
                            if (addIdx < 0) return;
                            list[addIdx] = { ...list[addIdx], returnToPrimary: !list[addIdx].returnToPrimary };
                            updateLocations(dayLocations.primary?.id ?? '', list.map((x) => ({ placeId: x.placeId, returnToPrimary: x.returnToPrimary })));
                          }}
                          aria-label="Toggle return to primary"
                        >
                          Return: {row.returnToPrimary ? 'Yes' : 'No'}
                        </button>
                      ) : null}
                      {!row.primary ? (
                        <button
                          type="button"
                          className={styles.clearPlaceBtn}
                          onClick={() => {
                            const addIdx = idx - 1;
                            if (addIdx < 0 || !dayLocations.primary) return;
                            const nextPrimary = dayLocations.additional[addIdx];
                            const remaining = dayLocations.additional
                              .filter((_, i) => i !== addIdx)
                              .map((x) => ({ ...x }));
                            remaining.unshift({ placeId: dayLocations.primary.id, place: dayLocations.primary, returnToPrimary: true });
                            updateLocations(nextPrimary.place.id, remaining.map((x) => ({ placeId: x.placeId, returnToPrimary: x.returnToPrimary })));
                          }}
                          aria-label="Set as primary"
                        >
                          Set as primary
                        </button>
                      ) : null}
                      <button
                        type="button"
                        className={styles.clearPlaceBtn}
                        onClick={() => {
                          if (row.primary) {
                            const firstAdditional = dayLocations.additional[0];
                            if (!firstAdditional) {
                              updateLocations('', []);
                              return;
                            }
                            updateLocations(
                              firstAdditional.place.id,
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
                        aria-label="Remove location"
                      >
                        ×
                      </button>
                      <button
                        type="button"
                        className={styles.clearPlaceBtn}
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
                        aria-label="Move location up"
                      >
                        ↑
                      </button>
                      <button
                        type="button"
                        className={styles.clearPlaceBtn}
                        onClick={() => {
                          const rows = dayLocations.additional.map((x) => ({ ...x }));
                          const current = idx - 1;
                          if (current < 0 || current >= rows.length - 1 || !dayLocations.primary) return;
                          const temp = rows[current + 1];
                          rows[current + 1] = rows[current];
                          rows[current] = temp;
                          updateLocations(dayLocations.primary.id, rows.map((x) => ({ placeId: x.placeId, returnToPrimary: x.returnToPrimary })));
                        }}
                        aria-label="Move location down"
                      >
                        ↓
                      </button>
                    </>
                  )}
                </span>
                <a className={styles.mapLink} href={`https://www.google.com/maps/@${row.place.latitude},${row.place.longitude},10z`} target="_blank" rel="noopener noreferrer">
                  Open in Google Maps
                </a>
              </span>
            ))}
          </div>
          {locationMessage ? <div className={styles.infoSub}>{locationMessage}</div> : null}
        </div>
      </div>
      <div className={styles.right}>
        <button type="button" className={styles.linkButton} onClick={() => setPlaceInfoOpen((v) => !v)}>
          {placeInfoOpen ? 'Hide place info' : 'Show place info'}
        </button>
        {placeInfoOpen ? (
          <div className={styles.placeInfoCard}>
            {infoPlace ? (
              <div className={styles.placeInfoGrid}>
                {dayLocations.additional.length ? <div className={styles.infoSub}>Place info for {infoPlace.title}</div> : null}
                <div className={styles.infoTile}>
                  <div className={styles.infoTitle}>Current weather</div>
                  {config.weatherApiKey.trim() && weather ? (
                    <>
                      <div className={styles.infoLine}>
                        <WeatherIcon iconCode={weather.iconCode} />
                        {Math.round(weather.temp)}°{config.temperatureUnit === 'Fahrenheit' ? 'F' : 'C'} · {weather.description}
                      </div>
                      <div className={styles.infoSub}>Sunrise {formatLocalFromUnix(weather.sunrise, weather.timezoneName)} · Sunset {formatLocalFromUnix(weather.sunset, weather.timezoneName)}</div>
                    </>
                  ) : (
                    <div className={styles.infoSub}>Set Visual Crossing API key in Settings</div>
                  )}
                </div>
                <div className={styles.infoTile}>
                  <div className={styles.infoTitle}>Typical for {(() => {
                    const d = new Date(`${weatherAnchorDate}T00:00:00.000Z`);
                    const dayOfMonth = d.getUTCDate();
                    const part = dayOfMonth <= 10 ? 'early' : dayOfMonth <= 20 ? 'mid' : 'late';
                    return `${part} ${d.toLocaleString('en-NZ', { month: 'long' })}`;
                  })()}</div>
                  {typicalWeather ? (
                    <>
                      <div className={styles.infoLine}>{typicalWeather.tempRange} · {typicalWeather.conditions}</div>
                      <div className={styles.infoSub}>Sunrise {hhmmOnly(typicalWeather.sunrise)} · Sunset {hhmmOnly(typicalWeather.sunset)}</div>
                    </>
                  ) : countryData && seasonal ? (
                    <>
                      <div className={styles.infoLine}>{seasonal.tempRange} · {seasonal.conditions}</div>
                      <div className={styles.infoSub}>Daylight: {seasonal.daylight}</div>
                    </>
                  ) : (
                    <div className={styles.infoSub}>Typical weather unavailable.</div>
                  )}
                </div>
                <div className={styles.infoTile}>
                  <div className={styles.infoTitle}>Currency and tipping</div>
                  {countryData ? (
                    <>
                      <div className={styles.infoLine}>{countryData.currency} ({countryData.currencyCode})</div>
                      <div className={styles.infoSub}>{countryData.tipping}</div>
                    </>
                  ) : (
                  <div className={styles.infoSub}>Currency/tipping guidance unavailable.</div>
                  )}
                </div>
              </div>
            ) : (
              <div className={styles.infoSub}>Set a primary location to view place intelligence.</div>
            )}
          </div>
        ) : null}
        {isShared ? null : (
          <div className={styles.rightActions}>
          <span className={styles.totalChip}>{formatCurrency(dayTotal, config.homeCurrency)}</span>
          {day.dayType === 'Sea' ? (
            <button
              type="button"
              className={styles.journalButton}
              onClick={() => {
                window.dispatchEvent(new CustomEvent('open-cruise-import'));
              }}
            >
              Import cruise
            </button>
          ) : null}
          <button
            type="button"
            className={styles.journalButton}
            onClick={() => setTipOpen((v) => !v)}
          >
            Tip calc
          </button>
          <button type="button" className={styles.journalButton} onClick={() => onWriteJournal?.()}>
            Journal entry
          </button>
          <button type="button" className={styles.addButton} onClick={onAddEntry}>
            + Add
          </button>
          </div>
        )}
        {tipOpen ? (
          <TipCalculator
            currency={countryData?.currencyCode || config.homeCurrency}
            defaultPercent={(() => {
              const t = (countryData?.tipping || '').toLowerCase();
              if (t.indexOf('not expected') >= 0 || t.indexOf('not customary') >= 0) return 0;
              const m = (countryData?.tipping || '').match(/(\d{1,2})\s?%/);
              return m ? Number(m[1]) : 10;
            })()}
            note={countryData?.tipping || 'No tipping guidance available for this location.'}
            onClose={() => setTipOpen(false)}
          />
        ) : null}
      </div>
    </header>
  );
};
