import * as React from 'react';
import type { Place } from '../../models/Place';
import { useConfig } from '../../context/ConfigContext';
import { COUNTRY_DATA } from '../../data/countryData';
import { SEASONAL_BY_REGION } from '../../data/seasonalWeather';
import { placeDisplayLabel } from '../../utils/placeDisplayLabel';
import { forecastDayLabelFromToday, todayYmd } from '../../utils/placeForecastDates';
import styles from './DayHeader.module.css';

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
    const compactTime = timePart.replace(/\s/g, '').toLowerCase();
    return `${datePart.replace(/,/g, '')} ${compactTime}`;
  } catch {
    return '';
  }
}

function WeatherIcon({ iconCode, size = 20 }: { iconCode: string; size?: number }): React.ReactElement {
  const code = (iconCode || '').toLowerCase();
  const stroke = '#1f4f78';
  const fillSun = '#f0b429';
  const fillCloud = '#8ec5ea';
  const fillRain = '#2f80c8';

  if (code.includes('clear-night') || code.includes('moon')) {
    return (
      <svg viewBox="0 0 24 24" width={size} height={size} aria-hidden>
        <path d="M14.5 3.8a7.5 7.5 0 1 0 6.7 11.2A6.5 6.5 0 1 1 14.5 3.8Z" fill={fillSun} stroke={stroke} strokeWidth="0.5" />
      </svg>
    );
  }
  if (code.includes('clear-day') || code === 'clear') {
    return (
      <svg viewBox="0 0 24 24" width={size} height={size} aria-hidden>
        <circle cx="12" cy="12" r="5" fill={fillSun} stroke={stroke} strokeWidth="0.5" />
        <g stroke={fillSun} strokeWidth="1.5" strokeLinecap="round">
          <line x1="12" y1="2" x2="12" y2="5" />
          <line x1="12" y1="19" x2="12" y2="22" />
          <line x1="2" y1="12" x2="5" y2="12" />
          <line x1="19" y1="12" x2="22" y2="12" />
        </g>
      </svg>
    );
  }
  if (code.includes('snow')) {
    return (
      <svg viewBox="0 0 24 24" width={size} height={size} aria-hidden>
        <path d="M12 3v18M7 7l10 10M17 7 7 17M5 12h14" stroke={fillRain} strokeWidth="1.5" strokeLinecap="round" />
      </svg>
    );
  }
  if (code.includes('rain') || code.includes('drizzle') || code.includes('showers')) {
    return (
      <svg viewBox="0 0 24 24" width={size} height={size} aria-hidden>
        <path d="M6.5 11h11a3 3 0 0 0 0-6 4 4 0 0 0-7.6-1.2A3 3 0 0 0 6.5 11Z" fill={fillCloud} />
        <g stroke={fillRain} strokeWidth="1.5" strokeLinecap="round">
          <line x1="8" y1="15" x2="7" y2="19" />
          <line x1="12" y1="15" x2="12" y2="20" />
          <line x1="16" y1="15" x2="17" y2="19" />
        </g>
      </svg>
    );
  }
  if (code.includes('wind') || code.includes('fog') || code.includes('haze')) {
    return (
      <svg viewBox="0 0 24 24" width={size} height={size} aria-hidden>
        <path d="M4 9h11a3 3 0 1 0-3-3M4 15h14a3 3 0 1 1-3 3" fill="none" stroke={stroke} strokeWidth="1.5" strokeLinecap="round" />
      </svg>
    );
  }
  if (code.includes('partly') || code.includes('cloudy')) {
    return (
      <svg viewBox="0 0 24 24" width={size} height={size} aria-hidden>
        <circle cx="8" cy="10" r="3.5" fill={fillSun} />
        <path d="M7 16h11a3.5 3.5 0 0 0 0-7 4 4 0 0 0-7.5-1.5A3 3 0 0 0 7 16Z" fill={fillCloud} stroke={stroke} strokeWidth="0.4" />
      </svg>
    );
  }
  return (
    <svg viewBox="0 0 24 24" width={size} height={size} aria-hidden>
      <path d="M6.5 14h11a3.5 3.5 0 0 0 0-7 4 4 0 0 0-7.6-1.4A3 3 0 0 0 6.5 14Z" fill={fillCloud} stroke={stroke} strokeWidth="0.4" />
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

  const monthIndex = React.useMemo(() => new Date().getMonth(), []);

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
    const lat = Number(place.latitude);
    const lng = Number(place.longitude);
    if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
      setWeather(null);
      return;
    }
    const units = config.temperatureUnit === 'Fahrenheit' ? 'us' : 'metric';
    const today = todayYmd();
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
    const lat = Number(place.latitude);
    const lng = Number(place.longitude);
    if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
      setForecastDays([]);
      return;
    }
    const units = config.temperatureUnit === 'Fahrenheit' ? 'us' : 'metric';
    const today = todayYmd();
    const apiStart = today;
    const apiEnd = datesForForecast[datesForForecast.length - 1];
    const range = apiStart === apiEnd ? apiStart : `${apiStart}/${apiEnd}`;
    const url = `https://weather.visualcrossing.com/VisualCrossingWebServices/rest/services/timeline/${lat},${lng}/${range}?key=${encodeURIComponent(config.weatherApiKey.trim())}&include=days&unitGroup=${units}&contentType=json`;
    fetch(url)
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error(`Forecast ${r.status}`))))
      .then((data) => {
        const byDate = new Map<string, { icon?: string; tempmax?: number; tempmin?: number; temp?: number; conditions?: string }>();
        for (const d of data.days ?? []) {
          const dt = String(d.datetime ?? d.date ?? '').slice(0, 10);
          if (dt) byDate.set(dt, d);
        }
        setForecastDays(
          datesForForecast.map((date) => {
            const row = byDate.get(date) ?? {};
            const tempMax = Number(row.tempmax ?? row.temp);
            const tempMin = Number(row.tempmin ?? row.temp);
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
    const d = new Date();
    const dayOfMonth = d.getDate();
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
        <div className={`${styles.forecastStripWrap} ${styles.placeInfoForecastRow}`}>
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
                  <WeatherIcon iconCode={fd.iconCode} size={32} />
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
              <WeatherIcon iconCode={weather.iconCode} size={22} />
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
          <div className={styles.infoSub}>Set a Visual Crossing API key in User settings to see weather here.</div>
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
      <div className={`${styles.infoTile} ${styles.placeInfoCurrencyRow}`}>
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
