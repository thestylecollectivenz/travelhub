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
  const { updateDay } = useTripWorkspace();
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

  const dayLocations = React.useMemo(
    () => {
      const ids = [day.primaryPlaceId, ...(day.additionalPlaceIds ?? [])].filter(Boolean) as string[];
      return ids.map((id) => placeById(id)).filter(Boolean);
    },
    [day.primaryPlaceId, day.additionalPlaceIds, placeById]
  );
  const primaryPlace = dayLocations[0];
  const infoPlace = dayLocations.length ? dayLocations[dayLocations.length - 1] : undefined;
  const countryData = infoPlace ? COUNTRY_DATA[infoPlace.countryCode] : undefined;
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
    const date = day.calendarDate;
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
  }, [placeInfoOpen, infoPlace, config.weatherApiKey, config.temperatureUnit, day.calendarDate]);
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

  const updateLocations = React.useCallback((ids: string[]) => {
    const normalized = ids.filter(Boolean);
    updateDay(day.id, {
      primaryPlaceId: normalized[0] ?? '',
      additionalPlaceIds: normalized.slice(1)
    });
  }, [day.id, updateDay]);

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
                          const existingIds = dayLocations.map((x) => x!.id);
                          const alreadyById = existingIds.indexOf(saved.id) >= 0;
                          const alreadyByTitle = dayLocations.some((x) => (x?.title || '').trim().toLowerCase() === (saved.title || '').trim().toLowerCase());
                          if (alreadyById || alreadyByTitle || ((saved.nominatimId || '') && dayLocations.some((x) => (x?.nominatimId || '') === saved.nominatimId))) {
                            setLocationMessage('Already added');
                            setLocationSearch('');
                            setLocationResults([]);
                            return;
                          }
                          updateLocations(Array.from(new Set([...existingIds, saved.id])));
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
            {dayLocations.map((p, idx) => (
              <span key={p!.id} className={styles.additionalRow}>
                <span className={styles.placePill}>
                  <span aria-hidden>📍</span> {p!.title}
                  {isShared ? null : (
                    <>
                      <button
                        type="button"
                        className={styles.clearPlaceBtn}
                        onClick={() => {
                          const ids = dayLocations.map((x) => x!.id).filter((id) => id !== p!.id);
                          updateLocations(ids);
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
                          const ids = dayLocations.map((x) => x!.id);
                          const temp = ids[idx - 1];
                          ids[idx - 1] = ids[idx];
                          ids[idx] = temp;
                          updateLocations(ids);
                        }}
                        aria-label="Move location up"
                      >
                        ↑
                      </button>
                      <button
                        type="button"
                        className={styles.clearPlaceBtn}
                        onClick={() => {
                          if (idx >= dayLocations.length - 1) return;
                          const ids = dayLocations.map((x) => x!.id);
                          const temp = ids[idx + 1];
                          ids[idx + 1] = ids[idx];
                          ids[idx] = temp;
                          updateLocations(ids);
                        }}
                        aria-label="Move location down"
                      >
                        ↓
                      </button>
                    </>
                  )}
                </span>
                <a className={styles.mapLink} href={`https://www.google.com/maps/@${p!.latitude},${p!.longitude},10z`} target="_blank" rel="noopener noreferrer">
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
                {dayLocations.length > 1 ? <div className={styles.infoSub}>Place info for {infoPlace.title}</div> : null}
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
                    const d = new Date(`${day.calendarDate}T00:00:00.000Z`);
                    const dayOfMonth = d.getUTCDate();
                    const part = dayOfMonth <= 10 ? 'early' : dayOfMonth <= 20 ? 'mid' : 'late';
                    return `${part} ${d.toLocaleString('en-NZ', { month: 'long' })}`;
                  })()}</div>
                  {typicalWeather ? (
                    <>
                      <div className={styles.infoLine}>{typicalWeather.tempRange} · {typicalWeather.conditions}</div>
                      <div className={styles.infoSub}>Sunrise {typicalWeather.sunrise} · Sunset {typicalWeather.sunset}</div>
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
          <button type="button" className={styles.journalButton} onClick={() => onWriteJournal?.()}>
            Write journal entry
          </button>
          <button type="button" className={styles.addButton} onClick={onAddEntry}>
            + Add
          </button>
          </div>
        )}
      </div>
    </header>
  );
};
