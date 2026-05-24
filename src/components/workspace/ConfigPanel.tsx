import * as React from 'react';
import { useConfig } from '../../context/ConfigContext';
import type { UserConfig } from '../../services/ConfigService';
import { DEFAULT_GEMINI_MODEL } from '../../services/GeminiService';
import { CurrencySelect } from '../shared/CurrencySelect';
import { SecretApiKeyField } from '../shared/SecretApiKeyField';

export interface ConfigPanelProps {
  isOpen: boolean;
  onClose: () => void;
}

export const ConfigPanel: React.FC<ConfigPanelProps> = ({ isOpen, onClose }) => {
  const { config, saveConfig } = useConfig();
  const [draft, setDraft] = React.useState<UserConfig>(config);
  const [weatherKeyDraft, setWeatherKeyDraft] = React.useState('');
  const [geminiKeyDraft, setGeminiKeyDraft] = React.useState('');

  const hasWeatherKey = Boolean((config.weatherApiKey || '').trim());
  const hasGeminiKey = Boolean((config.geminiApiKey || '').trim());

  React.useEffect(() => {
    if (isOpen) {
      setDraft(config);
      setWeatherKeyDraft('');
      setGeminiKeyDraft('');
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
        aria-label="User settings"
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
          <div>
            <h2 style={{ margin: 0, color: 'var(--color-blue-800)', fontSize: 'var(--font-size-lg)' }}>User settings</h2>
            <p style={{ margin: 'var(--space-1) 0 0', fontSize: 'var(--font-size-xs)', color: 'var(--color-sand-600)' }}>
              Applies to all trips on this account
            </p>
          </div>
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
            <CurrencySelect
              value={draft.homeCurrency}
              onChange={(code) => setDraft((d) => ({ ...d, homeCurrency: code }))}
              style={{ border: 'var(--border-default)', borderRadius: 'var(--radius-md)', padding: 'var(--space-2)' }}
            />
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

          <SecretApiKeyField
            label="Weather API key"
            panelOpen={isOpen}
            hasSavedKey={hasWeatherKey}
            value={weatherKeyDraft}
            onChange={setWeatherKeyDraft}
            placeholder="Paste a new Visual Crossing API key"
            hint="Free key from visualcrossing.com. Saved keys are masked and cannot be copied from this screen."
          />

          <SecretApiKeyField
            label="Gemini API key"
            panelOpen={isOpen}
            hasSavedKey={hasGeminiKey}
            value={geminiKeyDraft}
            onChange={setGeminiKeyDraft}
            placeholder="Paste a new Google AI Studio API key"
            hint={`Uses ${DEFAULT_GEMINI_MODEL} first (check RPM/RPD in AI Studio), then 2.5 Flash Lite / 2.5 Flash if quota blocked. Avoid models showing 0 limits. Saved keys are masked here.`}
          />

          <label style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)' }}>
            <input
              type="checkbox"
              checked={draft.showTravellerNames}
              onChange={(e) => setDraft((d) => ({ ...d, showTravellerNames: e.target.checked }))}
            />
            <span style={{ fontSize: 'var(--font-size-sm)', color: 'var(--color-blue-800)' }}>Show traveller names on trips</span>
          </label>

          <label style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)' }}>
            <input
              type="checkbox"
              checked={draft.dayBreakdownVisibleByDefault}
              onChange={(e) => setDraft((d) => ({ ...d, dayBreakdownVisibleByDefault: e.target.checked }))}
            />
            <span style={{ fontSize: 'var(--font-size-sm)', color: 'var(--color-blue-800)' }}>
              Show day budget breakdown by default
            </span>
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
              const weatherTrim = weatherKeyDraft.trim();
              const geminiTrim = geminiKeyDraft.trim();
              saveConfig({
                ...draft,
                weatherApiKey: weatherTrim || config.weatherApiKey,
                geminiApiKey: geminiTrim || config.geminiApiKey
              }).catch(console.error);
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
