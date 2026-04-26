import * as React from 'react';
import { useConfig } from '../../context/ConfigContext';
import type { UserConfig } from '../../services/ConfigService';

export interface ConfigPanelProps {
  isOpen: boolean;
  onClose: () => void;
}

const CURRENCY_OPTIONS = [
  'NZD', 'AUD', 'USD', 'EUR', 'GBP', 'JPY', 'CNY', 'SGD', 'HKD', 'THB',
  'IDR', 'MYR', 'PHP', 'KRW', 'INR', 'AED', 'SAR', 'ZAR', 'CHF', 'SEK',
  'NOK', 'DKK', 'CAD', 'MXN', 'BRL', 'CZK', 'HUF', 'PLN', 'RON', 'TRY',
  'ILS', 'EGP', 'VND', 'TWD', 'PKR', 'BDT', 'CLP', 'COP', 'PEN', 'UAH',
  'NGN', 'KES', 'GHS', 'MAD', 'XOF', 'XAF', 'FJD', 'PGK', 'WST', 'TOP',
  'SBD', 'VUV'
] as const;

export const ConfigPanel: React.FC<ConfigPanelProps> = ({ isOpen, onClose }) => {
  const { config, saveConfig } = useConfig();
  const [draft, setDraft] = React.useState<UserConfig>(config);

  React.useEffect(() => {
    if (isOpen) {
      setDraft(config);
    }
  }, [isOpen, config]);

  if (!isOpen) {
    return null;
  }

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        background: 'rgba(0,0,0,0.28)',
        zIndex: 1200,
        display: 'flex',
        justifyContent: 'flex-end'
      }}
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <aside
        style={{
          width: 'min(100%, 28rem)',
          height: '100%',
          background: 'var(--color-surface-raised)',
          borderLeft: 'var(--border-default)',
          boxShadow: 'var(--shadow-elevated)',
          display: 'flex',
          flexDirection: 'column',
          overflowY: 'auto'
        }}
        aria-label="Settings"
      >
        <div
          style={{
            padding: 'var(--space-5)',
            borderBottom: 'var(--border-default)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between'
          }}
        >
          <h2 style={{ margin: 0, color: 'var(--color-blue-800)', fontSize: 'var(--font-size-lg)' }}>Settings</h2>
          <button
            type="button"
            onClick={onClose}
            style={{
              border: 'none',
              background: 'transparent',
              color: 'var(--color-sand-600)',
              fontSize: 'var(--font-size-lg)',
              cursor: 'pointer'
            }}
            aria-label="Close settings"
          >
            ✕
          </button>
        </div>

        <div style={{ padding: 'var(--space-5)', display: 'grid', gap: 'var(--space-4)' }}>
          <label style={{ display: 'grid', gap: 'var(--space-1)' }}>
            <span style={{ fontSize: 'var(--font-size-sm)', color: 'var(--color-blue-800)' }}>Home currency</span>
            <select
              value={draft.homeCurrency}
              onChange={(e) => setDraft((d) => ({ ...d, homeCurrency: e.target.value }))}
              style={{ border: 'var(--border-default)', borderRadius: 'var(--radius-md)', padding: 'var(--space-2)' }}
            >
              {CURRENCY_OPTIONS.map((code) => (
                <option key={code} value={code}>
                  {code}
                </option>
              ))}
            </select>
          </label>

          <label style={{ display: 'grid', gap: 'var(--space-1)' }}>
            <span style={{ fontSize: 'var(--font-size-sm)', color: 'var(--color-blue-800)' }}>Temperature units</span>
            <select
              value={draft.temperatureUnit}
              onChange={(e) => setDraft((d) => ({ ...d, temperatureUnit: e.target.value as UserConfig['temperatureUnit'] }))}
              style={{ border: 'var(--border-default)', borderRadius: 'var(--radius-md)', padding: 'var(--space-2)' }}
            >
              <option value="Celsius">Celsius</option>
              <option value="Fahrenheit">Fahrenheit</option>
            </select>
          </label>

          <label style={{ display: 'grid', gap: 'var(--space-1)' }}>
            <span style={{ fontSize: 'var(--font-size-sm)', color: 'var(--color-blue-800)' }}>Distance units</span>
            <select
              value={draft.distanceUnit}
              onChange={(e) => setDraft((d) => ({ ...d, distanceUnit: e.target.value as UserConfig['distanceUnit'] }))}
              style={{ border: 'var(--border-default)', borderRadius: 'var(--radius-md)', padding: 'var(--space-2)' }}
            >
              <option value="Kilometres">Kilometres</option>
              <option value="Miles">Miles</option>
            </select>
          </label>

          <label style={{ display: 'grid', gap: 'var(--space-1)' }}>
            <span style={{ fontSize: 'var(--font-size-sm)', color: 'var(--color-blue-800)' }}>Journal display name</span>
            <input
              type="text"
              value={draft.journalAuthorName}
              onChange={(e) => setDraft((d) => ({ ...d, journalAuthorName: e.target.value }))}
              placeholder="Leave blank to use your Microsoft 365 display name"
              style={{ border: 'var(--border-default)', borderRadius: 'var(--radius-md)', padding: 'var(--space-2)' }}
            />
          </label>

          <label style={{ display: 'grid', gap: 'var(--space-1)' }}>
            <span style={{ fontSize: 'var(--font-size-sm)', color: 'var(--color-blue-800)' }}>Weather API key</span>
            <input
              type="text"
              value={draft.weatherApiKey}
              onChange={(e) => setDraft((d) => ({ ...d, weatherApiKey: e.target.value }))}
              placeholder="Visual Crossing API key (optional)"
              style={{ border: 'var(--border-default)', borderRadius: 'var(--radius-md)', padding: 'var(--space-2)' }}
            />
            <span style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-sand-600)' }}>
              Add your free Visual Crossing API key from visualcrossing.com to enable weather.
            </span>
          </label>

          <label style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)' }}>
            <input
              type="checkbox"
              checked={draft.showTravellerNames}
              onChange={(e) => setDraft((d) => ({ ...d, showTravellerNames: e.target.checked }))}
            />
            <span style={{ fontSize: 'var(--font-size-sm)', color: 'var(--color-blue-800)' }}>Show traveller names on trips</span>
          </label>
        </div>

        <div
          style={{
            marginTop: 'auto',
            padding: 'var(--space-4) var(--space-5)',
            borderTop: 'var(--border-default)',
            display: 'flex',
            justifyContent: 'flex-end',
            gap: 'var(--space-3)'
          }}
        >
          <button
            type="button"
            onClick={onClose}
            style={{
              border: 'var(--border-default)',
              background: 'transparent',
              color: 'var(--color-blue-700)',
              borderRadius: 'var(--radius-md)',
              padding: 'var(--space-2) var(--space-4)',
              cursor: 'pointer'
            }}
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={() => {
              saveConfig(draft).catch(console.error);
              onClose();
            }}
            style={{
              border: 'none',
              background: 'var(--color-primary)',
              color: 'var(--color-surface-raised)',
              borderRadius: 'var(--radius-md)',
              padding: 'var(--space-2) var(--space-4)',
              cursor: 'pointer'
            }}
          >
            Save settings
          </button>
        </div>
      </aside>
    </div>
  );
};
