import * as React from 'react';

export interface WeatherIconProps {
  iconCode: string;
  size?: number;
}

export const WeatherIcon: React.FC<WeatherIconProps> = ({ iconCode, size = 20 }) => {
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
        <path
          d="M4 9h11a3 3 0 1 0-3-3M4 15h14a3 3 0 1 1-3 3"
          fill="none"
          stroke={stroke}
          strokeWidth="1.5"
          strokeLinecap="round"
        />
      </svg>
    );
  }
  if (code.includes('partly') || code.includes('cloudy')) {
    return (
      <svg viewBox="0 0 24 24" width={size} height={size} aria-hidden>
        <circle cx="8" cy="10" r="3.5" fill={fillSun} />
        <path
          d="M7 16h11a3.5 3.5 0 0 0 0-7 4 4 0 0 0-7.5-1.5A3 3 0 0 0 7 16Z"
          fill={fillCloud}
          stroke={stroke}
          strokeWidth="0.4"
        />
      </svg>
    );
  }
  return (
    <svg viewBox="0 0 24 24" width={size} height={size} aria-hidden>
      <path
        d="M6.5 14h11a3.5 3.5 0 0 0 0-7 4 4 0 0 0-7.6-1.4A3 3 0 0 0 6.5 14Z"
        fill={fillCloud}
        stroke={stroke}
        strokeWidth="0.4"
      />
    </svg>
  );
};
