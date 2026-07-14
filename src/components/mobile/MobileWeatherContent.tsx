import * as React from 'react';
import type { Place } from '../../models/Place';
import { useConfig } from '../../context/ConfigContext';
import { COUNTRY_DATA } from '../../data/countryData';
import { SEASONAL_BY_REGION } from '../../data/seasonalWeather';
import { WeatherIcon } from '../shared/WeatherIcon';
import { placeDisplayLabel } from '../../utils/placeDisplayLabel';
import { placeQueryMapsUrl } from '../../utils/googleMapsLink';
import { forecastDatesFromToday, forecastDayLabelFromToday, todayYmd } from '../../utils/placeForecastDates';
import { localGreetingForCountry } from '../../utils/localGreetings';
import { languagePackForCountry } from '../../data/localLanguagePhrases';
import { useSpeechOutput } from '../../hooks/useSpeechOutput';
import styles from './MobileWeatherSheet.module.css';

function formatPlaceLocalDateTime(date: Date, timeZone: string): string {
  try {
    const datePart = new Intl.DateTimeFormat('en-NZ', {
      timeZone,
      weekday: 'short',
      day: 'numeric',
      month: 'short'
    }).format(date);
    const timePart = new Intl.DateTimeFormat('en-NZ', {
      timeZone,
      hour: '2-digit',
      minute: '2-digit',
      hour12: true
    }).format(date);
    return `${datePart.replace(/,/g, '')} ${timePart.replace(/\s/g, '').toLowerCase()}`;
  } catch {
    return '';
  }
}

function seasonForLatitude(month: number, latitude: number): 'Summer' | 'Autumn' | 'Winter' | 'Spring' {
  const north = latitude >= 0;
  if (north) {
    if (month === 11 || month === 0 || month === 1) return 'Winter';
    if (month >= 2 && month <= 4) return 'Spring';
    if (month >= 5 && month <= 7) return 'Summer';
    return 'Autumn';
  }
  if (month === 11 || month === 0 || month === 1) return 'Summer';
  if (month >= 2 && month <= 4) return 'Autumn';
  if (month >= 5 && month <= 7) return 'Winter';
  return 'Spring';
}

type ForecastDay = {
  date: string;
  label: string;
  iconCode: string;
  tempMin: number;
  tempMax: number;
};

export interface MobileWeatherContentProps {
  place: Place;
  weatherAnchorDate: string;
  travelTip?: string;
}

export const MobileWeatherContent: React.FC<MobileWeatherContentProps> = ({
  place,
  weatherAnchorDate,
  travelTip
}) => {
  const { config } = useConfig();
  const { speak } = useSpeechOutput();
  const [tempUnit, setTempUnit] = React.useState<'Celsius' | 'Fahrenheit'>(config.temperatureUnit);
  const countryData = COUNTRY_DATA[place.countryCode];
  const mapsUrl = placeQueryMapsUrl(placeDisplayLabel(place));
  const forecastDates = React.useMemo(() => forecastDatesFromToday(10), []);
  const today = todayYmd();
  const selectedDate = (weatherAnchorDate || today).slice(0, 10);

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
  const [forecastDays, setForecastDays] = React.useState<ForecastDay[]>([]);
  const [currentLocalTime, setCurrentLocalTime] = React.useState('');

  const typicalDate = React.useMemo(() => {
    const anchor = selectedDate;
    if (/^\d{4}-\d{2}-\d{2}$/.test(anchor)) return new Date(`${anchor}T00:00:00.000Z`);
    return new Date();
  }, [selectedDate]);

  const seasonal = React.useMemo(() => {
    if (!countryData) return undefined;
    return SEASONAL_BY_REGION[countryData.region]?.[typicalDate.getUTCMonth()];
  }, [countryData, typicalDate]);

  const currentSeason = React.useMemo(() => {
    if (!Number.isFinite(place.latitude)) return '';
    return seasonForLatitude(new Date().getMonth(), Number(place.latitude));
  }, [place.latitude]);

  const tempSuffix = tempUnit === 'Fahrenheit' ? 'F' : 'C';
  const unitLabel = tempUnit === 'Fahrenheit' ? '°F' : '°C';
  const languagePack = languagePackForCountry(place.countryCode);

  React.useEffect(() => {
    setTempUnit(config.temperatureUnit);
  }, [config.temperatureUnit]);

  React.useEffect(() => {
    if (!config.weatherApiKey.trim()) {
      setWeather(null);
      return;
    }
    const lat = Number(place.latitude);
    const lng = Number(place.longitude);
    if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
      setWeather(null);
      return;
    }
    const units = tempUnit === 'Fahrenheit' ? 'us' : 'metric';
    const url = `https://weather.visualcrossing.com/VisualCrossingWebServices/rest/services/timeline/${lat},${lng}/${today}?key=${encodeURIComponent(config.weatherApiKey.trim())}&unitGroup=${units}&include=current,days&contentType=json`;
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
      .catch(() => setWeather(null));
  }, [place.latitude, place.longitude, tempUnit, config.weatherApiKey, today]);

  React.useEffect(() => {
    if (!config.weatherApiKey.trim()) {
      setForecastDays([]);
      return;
    }
    const lat = Number(place.latitude);
    const lng = Number(place.longitude);
    if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
      setForecastDays([]);
      return;
    }
    const units = tempUnit === 'Fahrenheit' ? 'us' : 'metric';
    const apiEnd = forecastDates[forecastDates.length - 1];
    const range = today === apiEnd ? today : `${today}/${apiEnd}`;
    const url = `https://weather.visualcrossing.com/VisualCrossingWebServices/rest/services/timeline/${lat},${lng}/${range}?key=${encodeURIComponent(config.weatherApiKey.trim())}&include=days&unitGroup=${units}&contentType=json`;
    fetch(url)
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error(`Forecast ${r.status}`))))
      .then((data) => {
        const byDate = new Map<string, { icon?: string; tempmax?: number; tempmin?: number; temp?: number }>();
        for (const d of data.days ?? []) {
          const dt = String(d.datetime ?? d.date ?? '').slice(0, 10);
          if (dt) byDate.set(dt, d);
        }
        setForecastDays(
          forecastDates.map((date) => {
            const row = byDate.get(date) ?? {};
            const tempMax = Number(row.tempmax ?? row.temp);
            const tempMin = Number(row.tempmin ?? row.temp);
            const hasTemps = Number.isFinite(tempMax) || Number.isFinite(tempMin);
            return {
              date,
              label: forecastDayLabelFromToday(date, today),
              iconCode: String(row.icon ?? ''),
              tempMin: hasTemps ? Math.round(Number.isFinite(tempMin) ? tempMin : tempMax) : NaN,
              tempMax: hasTemps ? Math.round(Number.isFinite(tempMax) ? tempMax : tempMin) : NaN
            };
          })
        );
      })
      .catch(() => setForecastDays([]));
  }, [place.latitude, place.longitude, config.weatherApiKey, tempUnit, forecastDates, today]);

  const typicalWeatherQueryDate = React.useMemo(() => {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(selectedDate)) return selectedDate;
    if (selectedDate <= today) return selectedDate;
    const [, mm, dd] = selectedDate.split('-');
    return `2020-${mm}-${dd}`;
  }, [selectedDate, today]);

  React.useEffect(() => {
    if (!config.weatherApiKey.trim() || !typicalWeatherQueryDate) {
      setTypicalWeather(null);
      return;
    }
    const units = tempUnit === 'Fahrenheit' ? 'us' : 'metric';
    const url = `https://weather.visualcrossing.com/VisualCrossingWebServices/rest/services/timeline/${place.latitude},${place.longitude}/${typicalWeatherQueryDate}?key=${encodeURIComponent(config.weatherApiKey.trim())}&include=days&elements=tempmax,tempmin,sunrise,sunset,conditions&unitGroup=${units}&contentType=json`;
    fetch(url)
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error(`Weather ${r.status}`))))
      .then((data) => {
        const d = (data.days ?? [])[0] ?? {};
        setTypicalWeather({
          tempRange: `${Math.round(Number(d.tempmin ?? 0))}° to ${Math.round(Number(d.tempmax ?? 0))}°${tempSuffix}`,
          conditions: String(d.conditions ?? 'Typical conditions unavailable'),
          sunrise: String(d.sunrise ?? '—'),
          sunset: String(d.sunset ?? '—')
        });
      })
      .catch(() => setTypicalWeather(null));
  }, [place.latitude, place.longitude, typicalWeatherQueryDate, config.weatherApiKey, tempUnit, tempSuffix]);

  React.useEffect(() => {
    const tz = (place.timeZone?.trim() || weather?.timezoneName?.trim() || '').trim();
    if (!tz) {
      setCurrentLocalTime('');
      return undefined;
    }
    const tick = (): void => {
      try {
        setCurrentLocalTime(formatPlaceLocalDateTime(new Date(), tz));
      } catch {
        setCurrentLocalTime('');
      }
    };
    tick();
    const id = window.setInterval(tick, 60_000);
    return () => window.clearInterval(id);
  }, [place.timeZone, weather?.timezoneName]);

  const formatLocalFromUnix = (unix: number, tzName: string): string => {
    if (!unix) return '—';
    return new Date(unix * 1000).toLocaleTimeString('en-NZ', {
      hour: '2-digit',
      minute: '2-digit',
      hour12: false,
      timeZone: tzName || undefined
    });
  };

  const hhmmOnly = (value: string): string => {
    if (!value) return '—';
    const parts = value.split(':');
    return parts.length >= 2 ? `${parts[0]}:${parts[1]}` : value;
  };

  const typicalLabel = (() => {
    const d = typicalDate;
    const dayOfMonth = d.getUTCDate();
    const part = dayOfMonth <= 10 ? 'early' : dayOfMonth <= 20 ? 'mid' : 'late';
    return `${part} ${d.toLocaleString('en-NZ', { month: 'long', timeZone: 'UTC' })}`;
  })();

  const localHello = localGreetingForCountry(place.countryCode);

  return (
    <>
      <div className={styles.hero}>
        <div className={styles.heroIcon} aria-hidden>
          <WeatherIcon iconCode={weather?.iconCode || 'partly-cloudy-day'} size={30} />
        </div>
        <div className={styles.heroCopy}>
          <p className={styles.kicker}>Weather &amp; tips</p>
          {localHello ? <p className={styles.localGreeting}>{localHello}</p> : null}
          <h2 className={styles.title}>{placeDisplayLabel(place)}</h2>
          <p className={styles.location}>
            <svg width="11" height="11" viewBox="0 0 12 14" fill="none" aria-hidden>
              <path d="M6 1C3.79 1 2 2.79 2 5c0 3 4 8 4 8s4-5 4-8c0-2.21-1.79-4-4-4z" fill="currentColor" />
            </svg>
            {place.country || place.title}
          </p>
          {currentLocalTime ? <p className={styles.localTime}>{currentLocalTime}</p> : null}
        </div>
        {mapsUrl ? (
          <a className={styles.mapBtn} href={mapsUrl} target="_blank" rel="noopener noreferrer">
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" aria-hidden>
              <path d="M12 21s7-4.35 7-10a7 7 0 1 0-14 0c0 5.65 7 10 7 10Z" stroke="currentColor" strokeWidth="1.6" />
              <circle cx="12" cy="11" r="2" fill="currentColor" />
            </svg>
            Map
          </a>
        ) : null}
      </div>

      {config.weatherApiKey.trim() && forecastDays.length ? (
        <section className={styles.forecastSection} aria-label="10 day forecast">
          <div className={styles.forecastHead}>
            <h3 className={styles.forecastTitle}>10 day forecast</h3>
            <button
              type="button"
              className={styles.unitBtn}
              onClick={() => setTempUnit((u) => (u === 'Celsius' ? 'Fahrenheit' : 'Celsius'))}
              aria-label={`Switch to ${tempUnit === 'Celsius' ? 'Fahrenheit' : 'Celsius'}`}
            >
              {unitLabel} ▾
            </button>
          </div>
          <div className={styles.forecastStrip}>
            {forecastDays.map((fd) => {
              const dateLabel = new Date(`${fd.date}T12:00:00`).toLocaleDateString('en-NZ', {
                day: 'numeric',
                month: 'short'
              });
              const active = fd.date === selectedDate || (fd.date === today && selectedDate < today);
              return (
                <div
                  key={fd.date}
                  className={`${styles.forecastDay} ${active || fd.date === today ? styles.forecastDayActive : ''}`}
                >
                  <span className={styles.forecastDayName}>{fd.label}</span>
                  <span className={styles.forecastDayDate}>{dateLabel}</span>
                  <WeatherIcon iconCode={fd.iconCode} size={28} />
                  <span className={styles.forecastHigh}>
                    {Number.isFinite(fd.tempMax) ? `${fd.tempMax}°` : '—'}
                  </span>
                  <span className={styles.forecastLow}>
                    {Number.isFinite(fd.tempMin) ? `${fd.tempMin}°` : ''}
                  </span>
                </div>
              );
            })}
          </div>
        </section>
      ) : null}

      <div className={styles.weatherPair}>
        <article className={styles.infoCard}>
          <h3 className={styles.infoCardTitle}>Current weather</h3>
          {config.weatherApiKey.trim() && weather ? (
            <>
              <p className={styles.infoLine}>
                <WeatherIcon iconCode={weather.iconCode} size={22} />
                {Math.round(weather.temp)}°{tempSuffix} · {weather.description}
              </p>
              {currentSeason ? (
                <span className={styles.seasonPill}>
                  <WeatherIcon iconCode={currentSeason === 'Winter' ? 'snow' : 'clear-day'} size={14} />
                  {currentSeason}
                </span>
              ) : null}
              <p className={styles.infoSub}>
                Sunrise {formatLocalFromUnix(weather.sunrise, weather.timezoneName)} · Sunset{' '}
                {formatLocalFromUnix(weather.sunset, weather.timezoneName)}
              </p>
            </>
          ) : (
            <p className={styles.muted}>Set a Visual Crossing API key in User settings to see weather here.</p>
          )}
        </article>
        <article className={styles.infoCard}>
          <h3 className={styles.infoCardTitle}>Typical for {typicalLabel}</h3>
          {typicalWeather ? (
            <>
              <p className={styles.infoLine}>
                <WeatherIcon iconCode="rain" size={20} />
                {typicalWeather.tempRange} · {typicalWeather.conditions}
              </p>
              <p className={styles.infoSub}>
                Sunrise {hhmmOnly(typicalWeather.sunrise)} · Sunset {hhmmOnly(typicalWeather.sunset)}
              </p>
            </>
          ) : countryData && seasonal ? (
            <>
              <p className={styles.infoLine}>{seasonal.tempRange} · {seasonal.conditions}</p>
              <p className={styles.infoSub}>Daylight: {seasonal.daylight}</p>
            </>
          ) : (
            <p className={styles.muted}>Typical weather unavailable.</p>
          )}
        </article>
      </div>

      <article className={styles.sectionCard}>
        <span className={`${styles.sectionIcon} ${styles.iconOlive}`} aria-hidden>
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
            <rect x="3" y="6" width="18" height="13" rx="2" stroke="currentColor" strokeWidth="1.6" />
            <path d="M3 10h18M7 6V4h10v2" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
          </svg>
        </span>
        <div className={styles.sectionBody}>
          <p className={styles.sectionLabel}>Currency and tipping</p>
          {countryData ? (
            <>
              <p className={styles.sectionText}>
                {countryData.currency} ({countryData.currencyCode})
              </p>
              <p className={styles.sectionSub}>{countryData.tipping}</p>
            </>
          ) : (
            <p className={styles.sectionSub}>Currency/tipping guidance unavailable.</p>
          )}
        </div>
      </article>

      {travelTip ? (
        <article className={styles.sectionCard}>
          <span className={`${styles.sectionIcon} ${styles.iconTan}`} aria-hidden>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
              <path d="M9 18h6M10 22h4M12 2a6 6 0 0 0-4 10c.9.9 1.5 2.1 1.7 3.4H14c.2-1.3.8-2.5 1.7-3.4A6 6 0 0 0 12 2Z" stroke="currentColor" strokeWidth="1.6" strokeLinejoin="round" />
            </svg>
          </span>
          <div className={styles.sectionBody}>
            <p className={styles.sectionLabel}>Local tip</p>
            <p className={styles.sectionText}>{travelTip}</p>
          </div>
          <span className={styles.chevron} aria-hidden>›</span>
        </article>
      ) : null}

      <section className={styles.languageSection} aria-label="Language essentials">
        <div className={styles.languageHead}>
          <h3 className={styles.languageTitle}>Language essentials</h3>
          <button
            type="button"
            className={styles.hearAllBtn}
            onClick={() => speak(languagePack.phrases.map((p) => p.local).join('. '))}
          >
            Hear all phrases
          </button>
        </div>
        <div className={styles.phraseGrid}>
          {languagePack.phrases.map((phrase) => (
            <article key={phrase.english} className={styles.phraseCard}>
              <button
                type="button"
                className={styles.phrasePlay}
                aria-label={`Play ${phrase.english}`}
                onClick={() => speak(phrase.local)}
              >
                <svg width="14" height="14" viewBox="0 0 16 16" fill="none" aria-hidden>
                  <path d="M4 3.5v9l8-4.5-8-4.5Z" fill="currentColor" />
                </svg>
              </button>
              <div className={styles.phraseCopy}>
                <p className={styles.phraseLocal}>{phrase.local}</p>
                <p className={styles.phraseEnglish}>{phrase.english}</p>
              </div>
            </article>
          ))}
        </div>
        {languagePack.englishWidelySpoken ? (
          <p className={styles.languageNote}>English is widely spoken in tourist areas, but locals appreciate a few words in {languagePack.languageName}.</p>
        ) : null}
      </section>

      {config.weatherApiKey.trim() ? (
        <p className={styles.source}>Forecast source: Visual Crossing</p>
      ) : null}
    </>
  );
};
