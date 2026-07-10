import * as React from 'react';
import { useConfig } from '../../context/ConfigContext';
import { generateDiningSuggestions, generateNearestPlaces } from '../../services/GeminiService';
import type { NearestPlaceKind } from '../../utils/locationInfoEntry';
import { NEAR_YOU_TOOLS, type NearYouToolId } from '../../utils/nearYouTools';
import styles from './MobileHome.module.css';

export interface MobileNearYouPageProps {
  onBack: () => void;
}

export const MobileNearYouPage: React.FC<MobileNearYouPageProps> = ({ onBack }) => {
  const { config } = useConfig();
  const [busy, setBusy] = React.useState<NearYouToolId | null>(null);
  const [error, setError] = React.useState('');
  const [activeLabel, setActiveLabel] = React.useState('');
  const [results, setResults] = React.useState<Array<{ name: string; note?: string; mapsUrl?: string }>>([]);

  const run = async (id: NearYouToolId, label: string, kind?: NearestPlaceKind): Promise<void> => {
    const apiKey = (config.geminiApiKey || '').trim();
    if (!apiKey) {
      setError('Add a Gemini API key in Profile / User settings to use Near you.');
      setResults([]);
      return;
    }
    if (!navigator.geolocation) {
      setError('Location is not available on this device.');
      return;
    }
    setBusy(id);
    setError('');
    setActiveLabel(label);
    try {
      const pos = await new Promise<GeolocationPosition>((resolve, reject) => {
        navigator.geolocation.getCurrentPosition(resolve, reject, {
          enableHighAccuracy: true,
          timeout: 8000,
          maximumAge: 60000
        });
      });
      const searchContext = {
        mode: 'onsite' as const,
        latitude: pos.coords.latitude,
        longitude: pos.coords.longitude,
        placeName: 'Current location',
        country: ''
      };
      if (id === 'dining') {
        const { items } = await generateDiningSuggestions({ apiKey, searchContext });
        setResults(
          items.slice(0, 8).map((p) => ({
            name: p.name,
            note: p.bestFor || p.description || p.why,
            mapsUrl: p.mapsUrl
          }))
        );
      } else if (kind) {
        const { places } = await generateNearestPlaces(kind, { apiKey, searchContext });
        setResults(
          places.slice(0, 8).map((p) => ({
            name: p.name,
            note: p.note || p.address,
            mapsUrl: p.mapsUrl
          }))
        );
      }
    } catch (err) {
      setResults([]);
      setError(err instanceof Error ? err.message : 'Could not find nearby places.');
    } finally {
      setBusy(null);
    }
  };

  return (
    <div>
      <div className={styles.sectionHead}>
        <button type="button" className={styles.sectionLink} onClick={onBack}>
          ← Home
        </button>
      </div>
      <h2 className={styles.sectionTitle}>Near you</h2>
      <p className={styles.feedback} style={{ marginTop: 'var(--space-3)' }}>
        Uses your device GPS. Results are suggestions — always check opening hours and safety.
      </p>
      <div className={styles.listStack} style={{ marginTop: 'var(--space-3)' }}>
        {NEAR_YOU_TOOLS.map((tool) => (
          <button
            key={tool.id}
            type="button"
            className={styles.secondaryBtn}
            style={{ width: '100%', textAlign: 'left', borderRadius: '1rem', padding: '0.85rem 1rem' }}
            disabled={busy !== null}
            onClick={() => {
              run(tool.id, tool.label, tool.kind).catch(console.error);
            }}
          >
            <strong>{tool.label}</strong>
            <div style={{ fontSize: 'var(--font-size-xs)', color: 'var(--tl-muted)', marginTop: 4 }}>
              {busy === tool.id ? 'Searching…' : tool.description}
            </div>
          </button>
        ))}
      </div>
      {error ? <p className={`${styles.feedback} ${styles.errorText}`}>{error}</p> : null}
      {results.length ? (
        <div className={styles.feedback} aria-live="polite">
          <strong>{activeLabel}</strong>
          <ul style={{ margin: '0.5rem 0 0', paddingLeft: '1.1rem' }}>
            {results.map((r) => (
              <li key={`${r.name}-${r.note || ''}`}>
                {r.mapsUrl ? (
                  <a href={r.mapsUrl} target="_blank" rel="noreferrer">
                    {r.name}
                  </a>
                ) : (
                  r.name
                )}
                {r.note ? ` — ${r.note}` : ''}
              </li>
            ))}
          </ul>
        </div>
      ) : null}
    </div>
  );
};
