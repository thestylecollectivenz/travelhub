import * as React from 'react';
import type { Place } from '../../models/Place';
import { useConfig } from '../../context/ConfigContext';
import { COUNTRY_DATA } from '../../data/countryData';
import { SEASONAL_BY_REGION } from '../../data/seasonalWeather';
import { placeDisplayLabel } from '../../utils/placeDisplayLabel';
import { forecastDayLabelFromToday, todayYmd } from '../../utils/placeForecastDates';
import styles from './DayHeader.module.css';

function WeatherIcon({ iconCode, size = 14 }: { iconCode: string; size?: number }): React.ReactElement {
  const code = (iconCode || '').toLowerCase();
  if (code.includes('clear-night')) {
    return (
      <svg viewBox="0 0 16 16" width={size} height={size} aria-hidden>
        <path d="M10.8 2.2a5.2 5.2 0 1 0 3 8.7 5 5 0 1 1-3-8.7Z" fill="var(--color-blue-400)" />
      </svg>
    );
  }
  if (code.includes('clear-day')) {
    return (
      <svg viewBox="0 0 16 16" width={size} height={size} aria-hidden>
        <circle cx="8" cy="8" r="3.2" fill="var(--color-amber-400)" />
      </svg>
    );
  }
  if (code.includes('rain')) {
    return (
      <svg viewBox="0 0 16 16" width={size} height={size} aria-hidden>
        <path d="M4.3 9h7.2a2.4 2.4 0 0 0 0-4.8A3.3 3.3 0 0 0 5 3 2.8 2.8 0 0 0 4.3 9Z" fill="var(--color-blue-200)" />
      </svg>
    );
  }
  return (
    <svg viewBox="0 0 16 16" width={size} height={size} aria-hidden>
      <path d="M4.3 12h7.2a2 2 0 0 0 0-4 2.8 2.8 0 0 0-5.2-.8A2 2 0 0 0 6.2 12.5Z" fill="var(--color-blue-200)" />
    </svg>
  );
}

const FORECAST_DAY_SCROLL_PX = 56;

const FORECAST_SCROLL_THRESHOLD = 4;

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

function SeasonIcon({ season }: { season: 'Summer' | 'Autumn' | 'Winter' | 'Spring' }): React.ReactElement {
  if (season === 'Summer') return <span aria-hidden>☀️</span>;
  if (season === 'Winter') return <span aria-hidden>❄️</span>;
  if (season === 'Spring') return <span aria-hidden>🌸</span>;
  return <span aria-hidden>🍂</span>;
}

type ForecastDay = {
  date: string;
  label: string;
  iconCode: string;
  tempMin: number;
  tempMax: number;
  conditions: string;
};

export interface PlaceInfoPanelProps {
  place: Place;
  weatherAnchorDate: string;
  forecastDates?: string[];
  /** When true, render place name + local time header row. */
  showHeader?: boolean;
}

export const PlaceInfoPanel: React.FC<PlaceInfoPanelProps> = ({ place, weatherAnchorDate, forecastDates, showHeader }) => {
  const { config } = useConfig();
  const countryData = COUNTRY_DATA[place.countryCode];
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
  const [currentLocalTime, setCurrentLocalTime] = React.useState('');
  const [forecastDays, setForecastDays] = React.useState<ForecastDay[]>([]);
  const [forecastScroll, setForecastScroll] = React.useState(0);
  const forecastStripRef = React.useRef<HTMLDivElement | null>(null);

  const monthIndex = React.useMemo(() => {
    const d = new Date(`${weatherAnchorDate}T00:00:00.000Z`);
    return Number.isNaN(d.getTime()) ? 0 : d.getUTCMonth();
  }, [weatherAnchorDate]);

  const seasonal = React.useMemo(() => {
    if (!countryData) return undefined;
    return SEASONAL_BY_REGION[countryData.region]?.[monthIndex];
  }, [countryData, monthIndex]);

  const currentSeason = React.useMemo(() => {
    if (!Number.isFinite(place.latitude)) return '';
    return seasonForLatitude(new Date().getMonth(), Number(place.latitude));
  }, [place.latitude]);

  React.useEffect(() => {
    if (!config.weatherApiKey.trim()) {
      setWeather(null);
      return;
    }
    const units = config.temperatureUnit === 'Fahrenheit' ? 'us' : 'metric';
    const url = `https://weather.visualcrossing.com/VisualCrossingWebServices/rest/services/timeline/${place.latitude},${place.longitude}?key=${encodeURIComponent(config.weatherApiKey.trim())}&unitGroup=${units}&include=current,days&contentType=json`;
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
  }, [place.latitude, place.longitude, config.temperatureUnit, config.weatherApiKey]);

  const datesForForecast = React.useMemo(() => {
    const fromProp = (forecastDates ?? []).filter((d) => /^\d{4}-\d{2}-\d{2}$/.test(d));
    if (fromProp.length) return fromProp;
    const anchor = weatherAnchorDate.slice(0, 10);
    return anchor ? [anchor] : [];
  }, [forecastDates, weatherAnchorDate]);

  React.useEffect(() => {
    setForecastScroll(0);
  }, [datesForForecast.join(','), place.id]);

  React.useEffect(() => {
    if (!config.weatherApiKey.trim() || !datesForForecast.length) {
      setForecastDays([]);
      return;
    }
    const units = config.temperatureUnit === 'Fahrenheit' ? 'us' : 'metric';
    const today = todayYmd();
    const apiStart = today;
    const apiEnd = datesForForecast[datesForForecast.length - 1];
    const range = apiStart === apiEnd ? apiStart : `${apiStart}/${apiEnd}`;
    const url = `https://weather.visualcrossing.com/VisualCrossingWebServices/rest/services/timeline/${place.latitude},${place.longitude}/${range}?key=${encodeURIComponent(config.weatherApiKey.trim())}&include=days&elements=tempmax,tempmin,conditions,icon&unitGroup=${units}&contentType=json`;
    fetch(url)
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error(`Forecast ${r.status}`))))
      .then((data) => {
        const byDate = new Map<string, { icon?: string; tempmax?: number; tempmin?: number; conditions?: string }>();
        for (const d of data.days ?? []) {
          const dt = String(d.datetime ?? '').slice(0, 10);
          if (dt) byDate.set(dt, d);
        }
        setForecastDays(
          datesForForecast.map((date) => {
            const row = byDate.get(date) ?? {};
            const tempMax = Number(row.tempmax);
            const tempMin = Number(row.tempmin);
            const hasTemps = Number.isFinite(tempMax) || Number.isFinite(tempMin);
            return {
              date,
              label: forecastDayLabelFromToday(date, today),
              iconCode: String(row.icon ?? ''),
              tempMin: hasTemps ? Math.round(Number.isFinite(tempMin) ? tempMin : tempMax) : NaN,
              tempMax: hasTemps ? Math.round(Number.isFinite(tempMax) ? tempMax : tempMin) : NaN,
              conditions: String(row.conditions ?? '')
            };
          })
        );
      })
      .catch(() => setForecastDays([]));
  }, [place.latitude, place.longitude, config.weatherApiKey, config.temperatureUnit, datesForForecast]);

  React.useEffect(() => {
    if (!config.weatherApiKey.trim()) {
      setTypicalWeather(null);
      return;
    }
    const units = config.temperatureUnit === 'Fahrenheit' ? 'us' : 'metric';
    const url = `https://weather.visualcrossing.com/VisualCrossingWebServices/rest/services/timeline/${place.latitude},${place.longitude}/${weatherAnchorDate}?key=${encodeURIComponent(config.weatherApiKey.trim())}&include=days&elements=tempmax,tempmin,sunrise,sunset,conditions&unitGroup=${units}&contentType=json`;
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
  }, [place.latitude, place.longitude, weatherAnchorDate, config.weatherApiKey, config.temperatureUnit]);

  React.useEffect(() => {
    const tz = (place.timeZone?.trim() || weather?.timezoneName?.trim() || '').trim();
    if (!tz) {
      setCurrentLocalTime('');
      return undefined;
    }
    const tick = (): void => {
      try {
        setCurrentLocalTime(
          new Intl.DateTimeFormat('en-NZ', { timeZone: tz, hour: '2-digit', minute: '2-digit', hour12: true }).format(
            new Date()
          )
        );
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
    const d = new Date(`${weatherAnchorDate}T00:00:00.000Z`);
    const dayOfMonth = d.getUTCDate();
    const part = dayOfMonth <= 10 ? 'early' : dayOfMonth <= 20 ? 'mid' : 'late';
    return `${part} ${d.toLocaleString('en-NZ', { month: 'long' })}`;
  })();

  const tempSuffix = config.temperatureUnit === 'Fahrenheit' ? 'F' : 'C';

  return (
    <div className={styles.placeInfoGrid}>
      {showHeader ? (
        <div className={styles.placeInfoHeader}>
          <div className={styles.placeInfoHeaderMain}>
            <span className={styles.placeInfoHeaderLabel}>Place info</span>
            <span className={styles.placeInfoHeaderTitle}>{placeDisplayLabel(place)}</span>
          </div>
          {currentLocalTime ? <span className={styles.placeInfoHeaderTime}>{currentLocalTime}</span> : null}
        </div>
      ) : null}
      {config.weatherApiKey.trim() && forecastDays.length ? (
        <div className={styles.forecastStripWrap}>
          {forecastDays.length > FORECAST_SCROLL_THRESHOLD ? (
            <button
              type="button"
              className={styles.forecastScrollBtn}
              aria-label="Scroll forecast left"
              disabled={forecastScroll <= 0}
              onClick={() => {
                const el = forecastStripRef.current;
                if (!el) return;
                const next = Math.max(0, forecastScroll - 1);
                setForecastScroll(next);
                el.scrollTo({ left: next * FORECAST_DAY_SCROLL_PX, behavior: 'smooth' });
              }}
            >
              ‹
            </button>
          ) : null}
          <div className={styles.forecastStrip} ref={forecastStripRef} role="list" aria-label="Forecast for stay">
            {forecastDays.map((fd) => (
              <div key={fd.date} className={styles.forecastDay} role="listitem" title={fd.conditions}>
                <span className={styles.forecastDayLabel}>{fd.label}</span>
                <span className={styles.forecastDayIcon}>
                  <WeatherIcon iconCode={fd.iconCode} size={28} />
                </span>
                <span className={styles.forecastDayTemp}>
                  {Number.isFinite(fd.tempMin) && Number.isFinite(fd.tempMax)
                    ? `${fd.tempMin}°–${fd.tempMax}°${tempSuffix}`
                    : '—'}
                </span>
              </div>
            ))}
          </div>
          {forecastDays.length > FORECAST_SCROLL_THRESHOLD ? (
            <button
              type="button"
              className={styles.forecastScrollBtn}
              aria-label="Scroll forecast right"
              disabled={forecastScroll >= forecastDays.length - FORECAST_SCROLL_THRESHOLD}
              onClick={() => {
                const el = forecastStripRef.current;
                if (!el) return;
                const maxScroll = Math.max(0, forecastDays.length - FORECAST_SCROLL_THRESHOLD);
                const next = Math.min(maxScroll, forecastScroll + 1);
                setForecastScroll(next);
                el.scrollTo({ left: next * FORECAST_DAY_SCROLL_PX, behavior: 'smooth' });
              }}
            >
              ›
            </button>
          ) : null}
        </div>
      ) : null}
      <div className={styles.infoTile}>
        <div className={styles.infoTitle}>Current weather</div>
        {config.weatherApiKey.trim() && weather ? (
          <>
            <div className={styles.infoLine}>
              <WeatherIcon iconCode={weather.iconCode} />
              {Math.round(weather.temp)}°{config.temperatureUnit === 'Fahrenheit' ? 'F' : 'C'} · {weather.description}
            </div>
            {currentSeason ? (
              <div className={styles.infoSub}>
                <SeasonIcon season={currentSeason as 'Summer' | 'Autumn' | 'Winter' | 'Spring'} /> {currentSeason}
              </div>
            ) : null}
            <div className={styles.infoSub}>
              Sunrise {formatLocalFromUnix(weather.sunrise, weather.timezoneName)} · Sunset{' '}
              {formatLocalFromUnix(weather.sunset, weather.timezoneName)}
            </div>
          </>
        ) : (
          <div className={styles.infoSub}>Set Visual Crossing API key in User settings (My Trips)</div>
        )}
      </div>
      <div className={styles.infoTile}>
        <div className={styles.infoTitle}>Typical for {typicalLabel}</div>
        {typicalWeather ? (
          <>
            <div className={styles.infoLine}>
              {typicalWeather.tempRange} · {typicalWeather.conditions}
            </div>
            <div className={styles.infoSub}>
              Sunrise {hhmmOnly(typicalWeather.sunrise)} · Sunset {hhmmOnly(typicalWeather.sunset)}
            </div>
          </>
        ) : countryData && seasonal ? (
          <>
            <div className={styles.infoLine}>
              {seasonal.tempRange} · {seasonal.conditions}
            </div>
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
            <div className={styles.infoLine}>
              {countryData.currency} ({countryData.currencyCode})
            </div>
            <div className={styles.infoSub}>{countryData.tipping}</div>
          </>
        ) : (
          <div className={styles.infoSub}>Currency/tipping guidance unavailable.</div>
        )}
      </div>
    </div>
  );
};
