import * as React from 'react';
import { useConfig } from '../../context/ConfigContext';
import { GEMINI_MODEL_FALLBACK_CHAIN } from '../../services/GeminiService';
import styles from './MobileLocationTravelTip.module.css';

export interface MobileLocationTravelTipProps {
  placeLabel: string;
  categoryLabel?: string;
  startingPointLabel?: string;
  /** Persist current tip into the Location Info saved-tips section. */
  onSaveTip?: (tipText: string) => void;
  /** Remove a saved tip (X). */
  onDeleteTip?: (tipText: string) => void;
  /** Tips already saved — shown below when showSavedList is true. */
  savedTips?: string[];
  /** Only Location Info should list saved tips (Explore/Saved show the live tip only). */
  showSavedList?: boolean;
  onCreateTaskFromTip?: (tipText: string) => void;
  onAddTipToItinerary?: (tipText: string) => void;
}

function firstSentence(text: string): string {
  const t = text.trim();
  if (!t) return '';
  return t.split(/(?<=[.!?])\s+/)[0] || t;
}

function IconRefresh({ spinning }: { spinning?: boolean }): React.ReactElement {
  return (
    <svg
      width="16"
      height="16"
      viewBox="0 0 24 24"
      fill="none"
      aria-hidden
      className={spinning ? styles.spin : undefined}
    >
      <path
        d="M20 12a8 8 0 1 1-2.2-5.4"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
      />
      <path d="M20 4v5h-5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function IconSave(): React.ReactElement {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden>
      <path
        d="M17 3H5a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V7l-4-4Z"
        stroke="currentColor"
        strokeWidth="1.7"
        strokeLinejoin="round"
      />
      <path d="M7 3v5h8V3" stroke="currentColor" strokeWidth="1.7" strokeLinejoin="round" />
      <path d="M7 21v-8h10v8" stroke="currentColor" strokeWidth="1.7" strokeLinejoin="round" />
    </svg>
  );
}

function IconTask(): React.ReactElement {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" aria-hidden>
      <path d="M9 11.5 11 13.5 15.5 9" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" />
      <rect x="4" y="4" width="16" height="16" rx="2" stroke="currentColor" strokeWidth="1.6" />
    </svg>
  );
}

function IconItinerary(): React.ReactElement {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" aria-hidden>
      <rect x="4" y="5" width="16" height="15" rx="2" stroke="currentColor" strokeWidth="1.6" />
      <path d="M8 3v4M16 3v4M12 11v5M9.5 13.5H14.5" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
    </svg>
  );
}

async function generateTip(apiKey: string, prompt: string): Promise<string> {
  let lastErr: Error | undefined;
  for (const model of GEMINI_MODEL_FALLBACK_CHAIN) {
    try {
      const url = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent?key=${encodeURIComponent(apiKey)}`;
      const resp = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{ parts: [{ text: prompt }] }],
          generationConfig: { temperature: 1.05, maxOutputTokens: 100 }
        })
      });
      if (!resp.ok) {
        lastErr = new Error(`Gemini ${resp.status}`);
        continue;
      }
      const data = (await resp.json()) as {
        candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }>;
      };
      const text = firstSentence(
        (data.candidates?.[0]?.content?.parts?.[0]?.text || '').trim().replace(/^["']|["']$/g, '')
      );
      if (text) return text;
    } catch (e) {
      lastErr = e instanceof Error ? e : new Error('Tip request failed');
    }
  }
  throw lastErr || new Error('Tip request failed');
}

/**
 * Live AI travel tip strip — refreshes on demand and automatically every 30 seconds.
 * Save stores tips under Location Info (not Notes). Saved list only on Location Info.
 */
export const MobileLocationTravelTip: React.FC<MobileLocationTravelTipProps> = ({
  placeLabel,
  categoryLabel,
  startingPointLabel,
  onSaveTip,
  onDeleteTip,
  savedTips = [],
  showSavedList = false,
  onCreateTaskFromTip,
  onAddTipToItinerary
}) => {
  const { config } = useConfig();
  const [generated, setGenerated] = React.useState('');
  const [busy, setBusy] = React.useState(false);
  const [failed, setFailed] = React.useState(false);
  const [savedFlash, setSavedFlash] = React.useState(false);
  const [nonce, setNonce] = React.useState(0);
  const requestGenRef = React.useRef(0);
  const recentTipsRef = React.useRef<string[]>([]);
  // Stabilize saved-tips identity so parent re-renders don't re-fire Gemini.
  const savedTipsKey = savedTips.map((t) => t.trim()).filter(Boolean).join('\n');
  const savedTipsRef = React.useRef(savedTips);
  savedTipsRef.current = savedTips;

  const loadTip = React.useCallback(async (): Promise<void> => {
    const apiKey = (config.geminiApiKey || '').trim();
    if (!apiKey || !placeLabel.trim()) {
      setFailed(true);
      setGenerated('');
      setBusy(false);
      return;
    }

    const gen = ++requestGenRef.current;
    setBusy(true);
    setFailed(false);

    const near = startingPointLabel ? ` near ${startingPointLabel}` : '';
    const cat = categoryLabel ? ` focusing on ${categoryLabel}` : '';
    const avoid = [...recentTipsRef.current, ...savedTipsRef.current]
      .filter(Boolean)
      .slice(-8)
      .map((t) => `- ${t}`)
      .join('\n');
    const prompt =
      `Write ONE short practical travel tip (max 28 words) for a visitor to ${placeLabel}${near}${cat}. ` +
      `Make it specific, fresh, and different from generic advice.` +
      (avoid ? `\nDo NOT repeat or closely paraphrase any of these tips:\n${avoid}\n` : '\n') +
      `No quotes, no markdown, no emoji.`;

    try {
      const text = await generateTip(apiKey, prompt);
      if (gen !== requestGenRef.current) return;
      if (!text) {
        setFailed(true);
        setGenerated('');
        return;
      }
      recentTipsRef.current = [...recentTipsRef.current, text].slice(-12);
      setGenerated(text);
      setFailed(false);
    } catch {
      if (gen === requestGenRef.current) {
        setGenerated('');
        setFailed(true);
      }
    } finally {
      if (gen === requestGenRef.current) setBusy(false);
    }
    // savedTipsKey keeps avoid-list fresh without array-identity churn
  }, [placeLabel, categoryLabel, startingPointLabel, config.geminiApiKey, savedTipsKey, nonce]);

  React.useEffect(() => {
    void loadTip();
  }, [loadTip]);

  React.useEffect(() => {
    const id = window.setInterval(() => setNonce((n) => n + 1), 30_000);
    return () => window.clearInterval(id);
  }, []);

  const tip =
    generated ||
    (busy ? 'Getting a tip…' : '') ||
    (failed
      ? `Carry small change or a transit card for ${placeLabel || 'this area'}, and download offline maps before you go.`
      : 'Getting a tip…');

  const canSave = Boolean(generated) && !busy && Boolean(onSaveTip);
  const alreadySaved = savedTips.some((t) => t.trim().toLowerCase() === generated.trim().toLowerCase());

  return (
    <section className={styles.wrap} aria-label="Travel tips">
      <div className={styles.root}>
        <div className={styles.icon} aria-hidden>
          ✦
        </div>
        <div className={styles.body}>
          <div className={styles.titleRow}>
            <h3 className={styles.title}>Travel tip</h3>
            <div className={styles.actions}>
              <button
                type="button"
                className={styles.actionBtn}
                onClick={() => setNonce((n) => n + 1)}
                disabled={busy}
                aria-label="Refresh tip"
                title="Refresh tip"
              >
                <IconRefresh spinning={busy} />
              </button>
              {onSaveTip ? (
                <button
                  type="button"
                  className={styles.actionBtn}
                  onClick={() => {
                    if (!canSave || alreadySaved) return;
                    onSaveTip(generated);
                    setSavedFlash(true);
                    window.setTimeout(() => setSavedFlash(false), 2000);
                  }}
                  disabled={!canSave || alreadySaved}
                  aria-label="Save tip"
                  title="Save tip"
                >
                  <IconSave />
                </button>
              ) : null}
            </div>
          </div>
          <p className={styles.text}>{tip}</p>
          {savedFlash ? <p className={styles.feedback}>Saved to travel tips</p> : null}
        </div>
      </div>
      {showSavedList && savedTips.length ? (
        <div className={styles.savedBlock}>
          <h4 className={styles.savedTitle}>Saved travel tips</h4>
          <ul className={styles.savedList}>
            {savedTips.map((t) => (
              <li key={t} className={styles.savedItem}>
                <span className={styles.savedText}>{t}</span>
                <span className={styles.savedActions}>
                  {onCreateTaskFromTip ? (
                    <button
                      type="button"
                      className={styles.savedIconBtn}
                      aria-label="Create task from tip"
                      title="Create task"
                      onClick={() => onCreateTaskFromTip(t)}
                    >
                      <IconTask />
                    </button>
                  ) : null}
                  {onAddTipToItinerary ? (
                    <button
                      type="button"
                      className={styles.savedIconBtn}
                      aria-label="Add tip to itinerary"
                      title="Add to itinerary"
                      onClick={() => onAddTipToItinerary(t)}
                    >
                      <IconItinerary />
                    </button>
                  ) : null}
                  {onDeleteTip ? (
                    <button
                      type="button"
                      className={styles.savedX}
                      aria-label="Delete tip"
                      title="Delete tip"
                      onClick={() => onDeleteTip(t)}
                    >
                      ×
                    </button>
                  ) : null}
                </span>
              </li>
            ))}
          </ul>
        </div>
      ) : null}
    </section>
  );
};
