import * as React from 'react';
import { useConfig } from '../../context/ConfigContext';
import type { UserConfig } from '../../services/ConfigService';
import { DEFAULT_GEMINI_MODEL } from '../../services/GeminiService';
import {
  DEFAULT_ELEVENLABS_VOICE_ID,
  listElevenLabsVoicesWithFallback,
  type ElevenLabsVoice
} from '../../services/ElevenLabsService';
import {
  loadBrowserSpeechVoices,
  pickDefaultBrowserVoiceURI,
  speakPlainText,
  type BrowserSpeechVoiceOption
} from '../../utils/speechVoice';
import { CurrencySelect } from '../shared/CurrencySelect';
import { SecretApiKeyField } from '../shared/SecretApiKeyField';
import { useCanManageSiteConfig } from '../../hooks/useCanManageSiteConfig';
import { BookingAffiliateSettingsPanel } from './BookingAffiliateSettingsPanel';

export interface ConfigPanelProps {
  isOpen: boolean;
  onClose: () => void;
}

export const ConfigPanel: React.FC<ConfigPanelProps> = ({ isOpen, onClose }) => {
  const { config, saveConfig } = useConfig();
  const [draft, setDraft] = React.useState<UserConfig>(config);
  const [weatherKeyDraft, setWeatherKeyDraft] = React.useState('');
  const [geminiKeyDraft, setGeminiKeyDraft] = React.useState('');
  const [elevenLabsKeyDraft, setElevenLabsKeyDraft] = React.useState('');
  const [voices, setVoices] = React.useState<ElevenLabsVoice[]>([]);
  const [voicesLoading, setVoicesLoading] = React.useState(false);
  const [voicesError, setVoicesError] = React.useState('');
  const [browserVoices, setBrowserVoices] = React.useState<BrowserSpeechVoiceOption[]>([]);
  const [browserVoicesLoading, setBrowserVoicesLoading] = React.useState(false);
  const [saving, setSaving] = React.useState(false);
  const [saveError, setSaveError] = React.useState('');
  const [affiliateSettingsOpen, setAffiliateSettingsOpen] = React.useState(false);
  const canManageSite = useCanManageSiteConfig();

  const hasWeatherKey = Boolean((config.weatherApiKey || '').trim());
  const hasGeminiKey = Boolean((config.geminiApiKey || '').trim());
  const hasElevenLabsKey = Boolean((config.elevenLabsApiKey || '').trim());
  const effectiveElevenLabsKey = (elevenLabsKeyDraft.trim() || config.elevenLabsApiKey || '').trim();
  const speechEngine = draft.speechEngine === 'elevenlabs' ? 'elevenlabs' : 'browser';

  React.useEffect(() => {
    if (isOpen) {
      setDraft({
        ...config,
        speechEngine: config.speechEngine === 'elevenlabs' ? 'elevenlabs' : 'browser',
        browserVoiceURI: config.browserVoiceURI || ''
      });
      setWeatherKeyDraft('');
      setGeminiKeyDraft('');
      setElevenLabsKeyDraft('');
      setSaveError('');
      setVoicesError('');
      setSaving(false);
    }
  }, [isOpen, config]);

  React.useEffect(() => {
    if (!isOpen) return;
    let cancelled = false;
    setBrowserVoicesLoading(true);
    void loadBrowserSpeechVoices()
      .then((rows) => {
        if (cancelled) return;
        setBrowserVoices(rows);
        setDraft((d) => {
          if (d.browserVoiceURI) return d;
          const auto = pickDefaultBrowserVoiceURI(rows);
          return auto ? { ...d, browserVoiceURI: auto } : d;
        });
      })
      .finally(() => {
        if (!cancelled) setBrowserVoicesLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [isOpen]);

  React.useEffect(() => {
    if (!isOpen) return;
    if (!effectiveElevenLabsKey) {
      setVoices([]);
      setVoicesError('');
      return;
    }
    let cancelled = false;
    setVoicesLoading(true);
    setVoicesError('');
    void listElevenLabsVoicesWithFallback(effectiveElevenLabsKey)
      .then((result) => {
        if (cancelled) return;
        setVoices(result.voices);
        setVoicesError(result.usedCuratedFallback ? result.fallbackReason || '' : '');
        if (!result.voices.length) return;
        setDraft((d) => {
          if (d.elevenLabsVoiceId) return d;
          const preferred =
            result.voices.find((v) => v.voiceId === DEFAULT_ELEVENLABS_VOICE_ID) ?? result.voices[0];
          return { ...d, elevenLabsVoiceId: preferred.voiceId };
        });
      })
      .catch((err) => {
        if (cancelled) return;
        setVoices([]);
        setVoicesError(err instanceof Error ? err.message : 'Could not load ElevenLabs voices.');
      })
      .finally(() => {
        if (!cancelled) setVoicesLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [isOpen, effectiveElevenLabsKey]);

  if (!isOpen) {
    return null;
  }

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        background: 'rgba(0,0,0,0.28)',
        zIndex: 10050,
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
            onClick={() => {
              if (!saving) onClose();
            }}
            style={{
              border: 'none',
              background: 'transparent',
              color: 'var(--color-sand-600)',
              fontSize: 'var(--font-size-lg)',
              cursor: 'pointer'
            }}
            aria-label="Close settings"
            disabled={saving}
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
            <span style={{ fontSize: 'var(--font-size-sm)', color: 'var(--color-blue-800)' }}>Date format</span>
            <select
              value={draft.dateFormat}
              onChange={(e) => setDraft((d) => ({ ...d, dateFormat: e.target.value as UserConfig['dateFormat'] }))}
              style={{ border: 'var(--border-default)', borderRadius: 'var(--radius-md)', padding: 'var(--space-2)' }}
            >
              <option value="DMY">Day / month / year (29/05/2026)</option>
              <option value="MDY">Month / day / year (05/29/2026)</option>
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

          <label style={{ display: 'grid', gap: 'var(--space-1)' }}>
            <span style={{ fontSize: 'var(--font-size-sm)', color: 'var(--color-blue-800)' }}>Read-out voice engine</span>
            <select
              value={speechEngine}
              onChange={(e) =>
                setDraft((d) => ({
                  ...d,
                  speechEngine: e.target.value === 'elevenlabs' ? 'elevenlabs' : 'browser'
                }))
              }
              style={{ border: 'var(--border-default)', borderRadius: 'var(--radius-md)', padding: 'var(--space-2)' }}
            >
              <option value="browser">Free browser voices (recommended)</option>
              <option value="elevenlabs">ElevenLabs (uses credits)</option>
            </select>
            <span style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-sand-600)' }}>
              Browser voices are free and unlimited. ElevenLabs sounds better but burns monthly credits quickly on long read-outs.
            </span>
          </label>

          <label style={{ display: 'grid', gap: 'var(--space-1)' }}>
            <span style={{ fontSize: 'var(--font-size-sm)', color: 'var(--color-blue-800)' }}>Browser voice</span>
            <select
              value={draft.browserVoiceURI || ''}
              onChange={(e) => setDraft((d) => ({ ...d, browserVoiceURI: e.target.value }))}
              disabled={browserVoicesLoading}
              style={{ border: 'var(--border-default)', borderRadius: 'var(--radius-md)', padding: 'var(--space-2)' }}
            >
              {!browserVoices.length ? (
                <option value="">{browserVoicesLoading ? 'Loading voices…' : 'No browser voices found'}</option>
              ) : null}
              {browserVoices.map((v) => (
                <option key={v.voiceURI} value={v.voiceURI}>
                  {v.label}
                </option>
              ))}
            </select>
            <span style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-sand-600)' }}>
              Ranked with natural / neural / Online English voices first (Edge and Chrome usually have the best free options).
            </span>
            <button
              type="button"
              onClick={() => {
                const uri = draft.browserVoiceURI || pickDefaultBrowserVoiceURI(browserVoices);
                speakPlainText('Kia ora. This is how Travel Hub will sound when reading your itinerary.', undefined, {
                  speechEngine: 'browser',
                  browserVoiceURI: uri
                });
              }}
              style={{
                justifySelf: 'start',
                border: 'var(--border-default)',
                background: 'transparent',
                color: 'var(--color-blue-700)',
                borderRadius: 'var(--radius-md)',
                padding: 'var(--space-1) var(--space-3)',
                cursor: 'pointer',
                fontSize: 'var(--font-size-xs)'
              }}
              disabled={!browserVoices.length}
            >
              Preview browser voice
            </button>
          </label>

          <SecretApiKeyField
            label="ElevenLabs API key"
            panelOpen={isOpen}
            hasSavedKey={hasElevenLabsKey}
            value={elevenLabsKeyDraft}
            onChange={setElevenLabsKeyDraft}
            placeholder="Paste a new ElevenLabs API key"
            hint="Optional. Only used when Read-out voice engine is set to ElevenLabs. Free plan ~10k credits/month. Restricted keys need Text to Speech access."
          />

          <label style={{ display: 'grid', gap: 'var(--space-1)' }}>
            <span style={{ fontSize: 'var(--font-size-sm)', color: 'var(--color-blue-800)' }}>ElevenLabs voice</span>
            <select
              value={draft.elevenLabsVoiceId || ''}
              onChange={(e) => setDraft((d) => ({ ...d, elevenLabsVoiceId: e.target.value }))}
              disabled={speechEngine !== 'elevenlabs' || !effectiveElevenLabsKey || voicesLoading}
              style={{ border: 'var(--border-default)', borderRadius: 'var(--radius-md)', padding: 'var(--space-2)' }}
            >
              {speechEngine !== 'elevenlabs' ? <option value="">Switch engine to ElevenLabs to use</option> : null}
              {speechEngine === 'elevenlabs' && !effectiveElevenLabsKey ? (
                <option value="">Add an API key to load voices</option>
              ) : null}
              {speechEngine === 'elevenlabs' && effectiveElevenLabsKey && !voices.length && !voicesLoading ? (
                <option value={draft.elevenLabsVoiceId || DEFAULT_ELEVENLABS_VOICE_ID}>Default voice</option>
              ) : null}
              {voices.map((v) => (
                <option key={v.voiceId} value={v.voiceId}>
                  {v.name}
                  {v.description ? ` — ${v.description}` : v.category ? ` (${v.category})` : ''}
                </option>
              ))}
            </select>
            <span style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-sand-600)' }}>
              {voicesLoading
                ? 'Loading voices…'
                : voicesError
                  ? voicesError
                  : 'Only used when ElevenLabs is selected above.'}
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
          {canManageSite ? (
            <div style={{ borderTop: 'var(--border-default)', paddingTop: 'var(--space-3)' }}>
              <p style={{ margin: '0 0 var(--space-2)', fontSize: 'var(--font-size-sm)', color: 'var(--color-blue-800)', fontWeight: 700 }}>
                Site settings
              </p>
              <button
                type="button"
                onClick={() => setAffiliateSettingsOpen(true)}
                style={{
                  border: 'var(--border-default)',
                  background: 'transparent',
                  color: 'var(--color-blue-700)',
                  borderRadius: 'var(--radius-md)',
                  padding: 'var(--space-2) var(--space-3)',
                  cursor: 'pointer',
                  fontSize: 'var(--font-size-sm)',
                  width: '100%',
                  textAlign: 'left'
                }}
              >
                Booking affiliate partners…
              </button>
              <p style={{ margin: 'var(--space-1) 0 0', fontSize: 'var(--font-size-xs)', color: 'var(--color-sand-600)' }}>
                Configure site-wide partner links and affiliate IDs (owners / editors).
              </p>
            </div>
          ) : null}
          {saveError ? (
            <p style={{ margin: 0, fontSize: 'var(--font-size-sm)', color: 'var(--color-warning)' }}>{saveError}</p>
          ) : null}
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
            onClick={() => {
              if (!saving) onClose();
            }}
            style={{
              border: 'var(--border-default)',
              background: 'transparent',
              color: 'var(--color-blue-700)',
              borderRadius: 'var(--radius-md)',
              padding: 'var(--space-2) var(--space-4)',
              cursor: 'pointer'
            }}
            disabled={saving}
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={() => {
              const weatherTrim = weatherKeyDraft.trim();
              const geminiTrim = geminiKeyDraft.trim();
              const elevenTrim = elevenLabsKeyDraft.trim();
              setSaving(true);
              setSaveError('');
              void saveConfig({
                ...draft,
                speechEngine: draft.speechEngine === 'elevenlabs' ? 'elevenlabs' : 'browser',
                browserVoiceURI: draft.browserVoiceURI || pickDefaultBrowserVoiceURI(browserVoices),
                weatherApiKey: weatherTrim || config.weatherApiKey,
                geminiApiKey: geminiTrim || config.geminiApiKey,
                elevenLabsApiKey: elevenTrim || config.elevenLabsApiKey,
                elevenLabsVoiceId: draft.elevenLabsVoiceId || config.elevenLabsVoiceId || DEFAULT_ELEVENLABS_VOICE_ID
              })
                .then(() => {
                  setSaving(false);
                  onClose();
                })
                .catch((err) => {
                  console.error(err);
                  setSaving(false);
                  setSaveError(
                    err instanceof Error
                      ? err.message
                      : 'Could not save settings to SharePoint. Check list permissions and that UserConfig columns exist.'
                  );
                });
            }}
            style={{
              border: 'none',
              background: 'var(--color-primary)',
              color: 'var(--color-surface-raised)',
              borderRadius: 'var(--radius-md)',
              padding: 'var(--space-2) var(--space-4)',
              cursor: 'pointer'
            }}
            disabled={saving}
          >
            {saving ? 'Saving…' : 'Save settings'}
          </button>
        </div>
      </aside>
      {affiliateSettingsOpen ? <BookingAffiliateSettingsPanel onClose={() => setAffiliateSettingsOpen(false)} /> : null}
    </div>
  );
};
