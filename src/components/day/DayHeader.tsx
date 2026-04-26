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

function WeatherIcon({ kind }: { kind: string }): React.ReactElement {
  const k = kind.toLowerCase();
  if (k.includes('thunder')) {
    return <span aria-hidden>⛈</span>;
  }
  if (k.includes('snow')) {
    return <span aria-hidden>❄</span>;
  }
  if (k.includes('rain')) {
    return <span aria-hidden>🌧</span>;
  }
  if (k.includes('mist') || k.includes('fog') || k.includes('haze')) {
    return <span aria-hidden>🌫</span>;
  }
  if (k.includes('cloud')) {
    return <span aria-hidden>☁</span>;
  }
  return <span aria-hidden>☀</span>;
}

export const DayHeader: React.FC<DayHeaderProps> = ({ day, dayTotal, onAddEntry, onWriteJournal, variant = 'default' }) => {
  const { config } = useConfig();
  const { updateDay } = useTripWorkspace();
  const { searchPlaces, createOrReusePlace, placeById } = usePlaces();
  const isShared = variant === 'shared';
  const [isEditingTitle, setIsEditingTitle] = React.useState(false);
  const [titleDraft, setTitleDraft] = React.useState(day.displayTitle);
  const [typePickerOpen, setTypePickerOpen] = React.useState(false);
  const [primarySearchOpen, setPrimarySearchOpen] = React.useState(false);
  const [primarySearch, setPrimarySearch] = React.useState('');
  const [primaryResults, setPrimaryResults] = React.useState<PlaceCandidate[]>([]);
  const [additionalSearch, setAdditionalSearch] = React.useState('');
  const [additionalResults, setAdditionalResults] = React.useState<PlaceCandidate[]>([]);
  const [placeInfoOpen, setPlaceInfoOpen] = React.useState(false);
  const [weather, setWeather] = React.useState<{
    temp: number;
    description: string;
    main: string;
    sunrise: number;
    sunset: number;
    timezoneOffset: number;
  } | null>(null);

  const primaryPlace = placeById(day.primaryPlaceId);
  const additionalPlaces = React.useMemo(
    () => (day.additionalPlaceIds ?? []).map((id) => placeById(id)).filter(Boolean),
    [day.additionalPlaceIds, placeById]
  );
  const countryData = primaryPlace ? COUNTRY_DATA[primaryPlace.countryCode] : undefined;
  const monthIndex = React.useMemo(() => {
    const d = new Date(`${day.calendarDate}T00:00:00.000Z`);
    return Number.isNaN(d.getTime()) ? 0 : d.getUTCMonth();
  }, [day.calendarDate]);
  const seasonal = React.useMemo(() => {
    if (!countryData) return undefined;
    return SEASONAL_BY_REGION[countryData.region]?.[monthIndex];
  }, [countryData, monthIndex]);

  React.useEffect(() => {
    setTitleDraft(day.displayTitle);
  }, [day.displayTitle]);

  React.useEffect(() => {
    if (!primarySearchOpen || !primarySearch.trim()) {
      setPrimaryResults([]);
      return;
    }
    const t = window.setTimeout(() => {
      searchPlaces(primarySearch)
        .then((rows) => setPrimaryResults(rows))
        .catch(console.error);
    }, 400);
    return () => window.clearTimeout(t);
  }, [primarySearch, primarySearchOpen, searchPlaces]);

  React.useEffect(() => {
    if (!additionalSearch.trim()) {
      setAdditionalResults([]);
      return;
    }
    const t = window.setTimeout(() => {
      searchPlaces(additionalSearch)
        .then((rows) => setAdditionalResults(rows))
        .catch(console.error);
    }, 400);
    return () => window.clearTimeout(t);
  }, [additionalSearch, searchPlaces]);

  React.useEffect(() => {
    if (!placeInfoOpen || !primaryPlace || !config.weatherApiKey.trim()) {
      setWeather(null);
      return;
    }
    const units = config.temperatureUnit === 'Fahrenheit' ? 'imperial' : 'metric';
    const url = `https://api.openweathermap.org/data/2.5/weather?lat=${primaryPlace.latitude}&lon=${primaryPlace.longitude}&units=${units}&appid=${encodeURIComponent(config.weatherApiKey.trim())}`;
    fetch(url)
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error(`Weather ${r.status}`))))
      .then((data) => {
        setWeather({
          temp: Number(data.main?.temp ?? 0),
          description: String(data.weather?.[0]?.description ?? ''),
          main: String(data.weather?.[0]?.main ?? ''),
          sunrise: Number(data.sys?.sunrise ?? 0),
          sunset: Number(data.sys?.sunset ?? 0),
          timezoneOffset: Number(data.timezone ?? 0)
        });
      })
      .catch(() => {
        setWeather(null);
      });
  }, [placeInfoOpen, primaryPlace, config.temperatureUnit, config.weatherApiKey]);

  const formatLocalFromUnix = React.useCallback((unix: number, tzOffsetSec: number): string => {
    if (!unix) return '—';
    const d = new Date((unix + tzOffsetSec) * 1000);
    const hh = d.getUTCHours() < 10 ? `0${d.getUTCHours()}` : `${d.getUTCHours()}`;
    const mm = d.getUTCMinutes() < 10 ? `0${d.getUTCMinutes()}` : `${d.getUTCMinutes()}`;
    return `${hh}:${mm}`;
  }, []);

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
        <div className={styles.date}>{formatDayDate(day.calendarDate)}</div>
        <div className={styles.placeSection}>
          <div className={styles.primaryRow}>
            {primaryPlace ? (
              <>
                <span className={styles.placePill}>
                  <span aria-hidden>📍</span> {primaryPlace.title}
                </span>
                <a
                  className={styles.mapLink}
                  href={`https://www.google.com/maps/search/?api=1&query=${primaryPlace.latitude},${primaryPlace.longitude}`}
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  Open in Google Maps
                </a>
                {isShared ? null : (
                  <button
                    type="button"
                    className={styles.clearPlaceBtn}
                    onClick={() => updateDay(day.id, { primaryPlaceId: '', additionalPlaceIds: (day.additionalPlaceIds ?? []).filter(Boolean) })}
                    aria-label="Clear primary place"
                  >
                    ×
                  </button>
                )}
              </>
            ) : isShared ? (
              <span className={styles.mapLink}>No location set</span>
            ) : (
              <button type="button" className={styles.linkButton} onClick={() => setPrimarySearchOpen((v) => !v)}>
                Add location
              </button>
            )}
          </div>
          {!isShared && primarySearchOpen ? (
            <div className={styles.searchWrap}>
              <input
                className={styles.placeInput}
                value={primarySearch}
                onChange={(e) => setPrimarySearch(e.target.value)}
                placeholder="Search location"
              />
              {primaryResults.length ? (
                <div className={styles.searchDropdown}>
                  {primaryResults.map((p) => (
                    <button
                      key={p.nominatimId}
                      type="button"
                      className={styles.searchOption}
                      onClick={() => {
                        createOrReusePlace({
                          title: p.title,
                          latitude: p.latitude,
                          longitude: p.longitude,
                          country: p.country,
                          countryCode: p.countryCode,
                          placeType: p.placeType,
                          timeZone: p.timeZone,
                          nominatimId: p.nominatimId
                        })
                          .then((saved) => {
                            updateDay(day.id, { primaryPlaceId: saved.id });
                            setPrimarySearchOpen(false);
                            setPrimarySearch('');
                            setPrimaryResults([]);
                          })
                          .catch(console.error);
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

          {(additionalPlaces.length > 0 || !isShared) ? (
            <div className={styles.additionalRow}>
              <span className={styles.alsoVisiting}>Also visiting</span>
              <div className={styles.additionalList}>
                {additionalPlaces.map((p) => (
                  <span key={p!.id} className={styles.placePill}>
                    {p!.title}
                    {isShared ? null : (
                      <button
                        type="button"
                        className={styles.clearPlaceBtn}
                        onClick={() =>
                          updateDay(day.id, {
                            additionalPlaceIds: (day.additionalPlaceIds ?? []).filter((id) => id !== p!.id)
                          })
                        }
                      >
                        ×
                      </button>
                    )}
                  </span>
                ))}
              </div>
              {isShared ? null : (
                <div className={styles.searchWrap}>
                  <input
                    className={styles.placeInput}
                    value={additionalSearch}
                    onChange={(e) => setAdditionalSearch(e.target.value)}
                    placeholder="Add another place"
                  />
                  {additionalResults.length ? (
                    <div className={styles.searchDropdown}>
                      {additionalResults.map((p) => (
                        <button
                          key={p.nominatimId}
                          type="button"
                          className={styles.searchOption}
                          onClick={() => {
                            createOrReusePlace({
                              title: p.title,
                              latitude: p.latitude,
                              longitude: p.longitude,
                              country: p.country,
                              countryCode: p.countryCode,
                              placeType: p.placeType,
                              timeZone: p.timeZone,
                              nominatimId: p.nominatimId
                            })
                              .then((saved) => {
                                const next = Array.from(new Set([...(day.additionalPlaceIds ?? []), saved.id]));
                                updateDay(day.id, { additionalPlaceIds: next });
                                setAdditionalSearch('');
                                setAdditionalResults([]);
                              })
                              .catch(console.error);
                          }}
                        >
                          <span>{p.title}</span>
                          <span className={styles.searchMeta}>{p.country}</span>
                        </button>
                      ))}
                    </div>
                  ) : null}
                </div>
              )}
            </div>
          ) : null}

          <button type="button" className={styles.linkButton} onClick={() => setPlaceInfoOpen((v) => !v)}>
            {placeInfoOpen ? 'Hide place info' : 'Place info'}
          </button>
          {placeInfoOpen ? (
            <div className={styles.placeInfoCard}>
              {primaryPlace ? (
                <div className={styles.placeInfoGrid}>
                  {config.weatherApiKey.trim() && weather ? (
                    <div className={styles.infoTile}>
                      <div className={styles.infoTitle}>Current weather</div>
                      <div className={styles.infoLine}>
                        <WeatherIcon kind={weather.main} />
                        {Math.round(weather.temp)}°{config.temperatureUnit === 'Fahrenheit' ? 'F' : 'C'} · {weather.description}
                      </div>
                      <div className={styles.infoSub}>Sunrise {formatLocalFromUnix(weather.sunrise, weather.timezoneOffset)} · Sunset {formatLocalFromUnix(weather.sunset, weather.timezoneOffset)}</div>
                    </div>
                  ) : null}
                  {countryData && seasonal ? (
                    <div className={styles.infoTile}>
                      <div className={styles.infoTitle}>Typical for {new Date(`${day.calendarDate}T00:00:00.000Z`).toLocaleString('en-NZ', { month: 'long' })}</div>
                      <div className={styles.infoLine}>{seasonal.tempRange} · {seasonal.conditions}</div>
                      <div className={styles.infoSub}>Daylight: {seasonal.daylight}</div>
                    </div>
                  ) : null}
                  {countryData ? (
                    <div className={styles.infoTile}>
                      <div className={styles.infoTitle}>Currency and tipping</div>
                      <div className={styles.infoLine}>{countryData.currency} ({countryData.currencyCode})</div>
                      <div className={styles.infoSub}>{countryData.tipping}</div>
                    </div>
                  ) : null}
                  {!config.weatherApiKey.trim() ? <div className={styles.infoSub}>Set Weather API key in Settings to show live weather.</div> : null}
                </div>
              ) : (
                <div className={styles.infoSub}>Set a primary place to view place intelligence.</div>
              )}
            </div>
          ) : null}
        </div>
      </div>
      {isShared ? null : (
        <div className={styles.right}>
          <span className={styles.totalChip}>{formatCurrency(dayTotal, config.homeCurrency)}</span>
          <button type="button" className={styles.journalButton} onClick={() => onWriteJournal?.()}>
            Write journal entry
          </button>
          <button type="button" className={styles.addButton} onClick={onAddEntry}>
            + Add
          </button>
        </div>
      )}
    </header>
  );
};
