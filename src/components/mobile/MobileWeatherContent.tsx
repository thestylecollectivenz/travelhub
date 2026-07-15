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
import { useTripWorkspace } from '../../context/TripWorkspaceContext';
import styles from './MobileWeatherSheet.module.css';

const TIP_PRESETS = [5, 10, 15, 20] as const;

function defaultTipPercent(tipping?: string): number {
  const m = (tipping || '').match(/(\d{1,2})\s?%/);
  if (m) return Number(m[1]);
  return 10;
}

function formatMoney(amount: number, currency: string): string {
  const code = (currency || 'NZD').toUpperCase();
  return `${code} ${amount.toFixed(2)}`;
}

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
  const { convertToHomeCurrency } = useTripWorkspace();
  const { speak } = useSpeechOutput();
  const [tempUnit, setTempUnit] = React.useState<'Celsius' | 'Fahrenheit'>(config.temperatureUnit);
  const [billAmount, setBillAmount] = React.useState('');
  const [tipPercent, setTipPercent] = React.useState(10);
  const [tipCustom, setTipCustom] = React.useState(false);
  const [customPercent, setCustomPercent] = React.useState('12');
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
  const phraseLang = languagePack.phrases.find((p) => p.lang)?.lang;
  const localCurrency = countryData?.currencyCode || config.homeCurrency || 'NZD';
  const homeCurrency = (config.homeCurrency || 'NZD').toUpperCase();

  React.useEffect(() => {
    setTempUnit(config.temperatureUnit);
  }, [config.temperatureUnit]);

  React.useEffect(() => {
    const pct = defaultTipPercent(countryData?.tipping);
    setTipPercent(pct);
    setTipCustom(false);
    setBillAmount('');
  }, [place.countryCode, countryData?.tipping]);

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

  const effectiveTipPercent = tipCustom
    ? Math.max(0, Number(customPercent) || 0)
    : tipPercent;
  const billValue = Math.max(0, Number(billAmount.replace(/,/g, '')) || 0);
  const tipAmount = billValue * (effectiveTipPercent / 100);
  const tipTotal = billValue + tipAmount;
  const showHomeFx = homeCurrency !== localCurrency.toUpperCase();
  const tipHome = showHomeFx ? convertToHomeCurrency(tipAmount, localCurrency) : tipAmount;
  const totalHome = showHomeFx ? convertToHomeCurrency(tipTotal, localCurrency) : tipTotal;
  const fxRate =
    tipAmount > 0 && tipHome > 0 ? tipHome / tipAmount : showHomeFx ? convertToHomeCurrency(1, localCurrency) : 1;

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

      <article className={styles.currencyCard}>
        <div className={styles.currencyAdvice}>
          <div className={styles.currencyBlock}>
            <span className={`${styles.sectionIcon} ${styles.iconOlive}`} aria-hidden>
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
                <circle cx="12" cy="12" r="8.5" stroke="currentColor" strokeWidth="1.6" />
                <path d="M12 8v8M9.5 10.5c.5-.8 1.4-1.2 2.5-1.2 1.4 0 2.5.8 2.5 2s-1.1 2-2.5 2H11c-1.4 0-2.5.9-2.5 2s1.2 2 2.7 2c1.1 0 2-.4 2.5-1.1" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
              </svg>
            </span>
            <div className={styles.sectionBody}>
              <p className={styles.sectionLabel}>Currency</p>
              {countryData ? (
                <p className={styles.sectionText}>
                  {countryData.currency} ({countryData.currencyCode})
                </p>
              ) : (
                <p className={styles.sectionSub}>Currency guidance unavailable.</p>
              )}
            </div>
          </div>
          <div className={styles.currencyBlock}>
            <span className={`${styles.sectionIcon} ${styles.iconTan}`} aria-hidden>
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
                <circle cx="9" cy="9" r="2.5" stroke="currentColor" strokeWidth="1.5" />
                <circle cx="15" cy="9" r="2.5" stroke="currentColor" strokeWidth="1.5" />
                <path d="M5.5 17c.8-2 2.4-3 4.5-3s3.7 1 4.5 3M14 14c1.6.2 2.9 1 3.5 3" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
              </svg>
            </span>
            <div className={styles.sectionBody}>
              <p className={styles.sectionLabel}>Tipping advice</p>
              <p className={styles.sectionSub}>
                {countryData?.tipping || 'Tipping guidance unavailable for this location.'}
              </p>
            </div>
          </div>
        </div>

        <div className={styles.tipCalc}>
          <div className={styles.tipCalcHead}>
            <span className={`${styles.sectionIcon} ${styles.iconOlive}`} aria-hidden>
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
                <rect x="4" y="3" width="16" height="18" rx="2" stroke="currentColor" strokeWidth="1.5" />
                <path d="M8 8h8M8 12h8M8 16h5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
              </svg>
            </span>
            <p className={styles.sectionLabel}>Tip calculator</p>
          </div>
          <label className={styles.tipLabel}>
            Enter bill amount
            <span className={styles.tipInputWrap}>
              <span className={styles.tipCurrencyPrefix}>{localCurrency}</span>
              <input
                className={styles.tipInput}
                type="text"
                inputMode="decimal"
                value={billAmount}
                onChange={(e) => setBillAmount(e.target.value.replace(/[^\d.]/g, ''))}
                placeholder="0.00"
                aria-label="Bill amount"
              />
            </span>
          </label>
          <div className={styles.tipPctRow} role="group" aria-label="Tip percentage">
            {TIP_PRESETS.map((pct) => (
              <button
                key={pct}
                type="button"
                className={`${styles.tipPctBtn} ${!tipCustom && tipPercent === pct ? styles.tipPctBtnOn : ''}`}
                onClick={() => {
                  setTipCustom(false);
                  setTipPercent(pct);
                }}
              >
                {pct}%
              </button>
            ))}
            <button
              type="button"
              className={`${styles.tipPctBtn} ${tipCustom ? styles.tipPctBtnOn : ''}`}
              onClick={() => setTipCustom(true)}
            >
              Custom
            </button>
          </div>
          {tipCustom ? (
            <label className={styles.tipLabel}>
              Custom tip %
              <input
                className={styles.tipCustomInput}
                type="number"
                min={0}
                step={0.5}
                value={customPercent}
                onChange={(e) => setCustomPercent(e.target.value)}
              />
            </label>
          ) : null}
          <div className={styles.tipResultBox}>
            <div className={styles.tipResultLocal}>
              <div className={styles.tipResultRow}>
                <span>Tip amount</span>
                <strong>{formatMoney(tipAmount, localCurrency)}</strong>
              </div>
              <div className={styles.tipResultRow}>
                <span>Total</span>
                <strong>{formatMoney(tipTotal, localCurrency)}</strong>
              </div>
            </div>
            {showHomeFx ? (
              <div className={styles.tipResultHome}>
                <p className={styles.tipResultHomeLabel}>Converted to your home currency</p>
                <div className={styles.tipResultRow}>
                  <span>Tip</span>
                  <strong>{formatMoney(tipHome, homeCurrency)}</strong>
                </div>
                <div className={styles.tipResultRow}>
                  <span>Total</span>
                  <strong>{formatMoney(totalHome, homeCurrency)}</strong>
                </div>
                <p className={styles.tipRateNote}>
                  1 {localCurrency.toUpperCase()} ≈ {fxRate.toFixed(4)} {homeCurrency}
                </p>
              </div>
            ) : null}
          </div>
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
            onClick={() => speak(languagePack.phrases.map((p) => p.local).join('. '), phraseLang)}
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" aria-hidden>
              <path d="M3 10v4h4l5 4V6L7 10H3Z" fill="currentColor" />
              <path d="M16 9a4 4 0 0 1 0 6M18.5 7a7 7 0 0 1 0 10" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
            </svg>
            Hear all phrases
          </button>
        </div>
        <div className={styles.phraseGrid}>
          {languagePack.phrases.map((phrase) => (
            <article key={phrase.english} className={styles.phraseCard}>
              <button
                type="button"
                className={styles.phrasePlay}
                aria-label={`Play ${phrase.english} in ${languagePack.languageName}`}
                onClick={() => speak(phrase.local, phrase.lang || phraseLang)}
              >
                <svg width="14" height="14" viewBox="0 0 16 16" fill="none" aria-hidden>
                  <path d="M4 3.5v9l8-4.5-8-4.5Z" fill="currentColor" />
                </svg>
              </button>
              <div className={styles.phraseCopy}>
                <p className={styles.phraseEnglish}>{phrase.english}</p>
                <p className={styles.phraseLocal}>{phrase.local}</p>
              </div>
            </article>
          ))}
        </div>
        {languagePack.englishWidelySpoken ? (
          <p className={styles.languageNote}>
            English is widely spoken in tourist areas, but locals appreciate a few words in {languagePack.languageName}.
          </p>
        ) : null}
      </section>

      {config.weatherApiKey.trim() ? (
        <p className={styles.source}>Forecast source: Visual Crossing</p>
      ) : null}
    </>
  );
};
