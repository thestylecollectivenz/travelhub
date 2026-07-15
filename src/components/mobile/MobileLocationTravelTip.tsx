import * as React from 'react';
import { useConfig } from '../../context/ConfigContext';
import styles from './MobileLocationTravelTip.module.css';

export interface MobileLocationTravelTipProps {
  placeLabel: string;
  /** Seed text while waiting for a fresh tip (not used as a permanent cache). */
  existingTipHtml?: string;
  categoryLabel?: string;
  startingPointLabel?: string;
  /** Append the current tip as a bullet under Notes. */
  onAppendToNotes?: (tipText: string) => void;
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

function IconAppend(): React.ReactElement {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden>
      <path d="M8 6h11M8 12h11M8 18h11M4 6h.01M4 12h.01M4 18h.01" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
    </svg>
  );
}

/**
 * Compact AI travel tip strip. Regenerates on each mount / refresh.
 * Always visible so tips are not missed off-screen.
 */
export const MobileLocationTravelTip: React.FC<MobileLocationTravelTipProps> = ({
  placeLabel,
  categoryLabel,
  startingPointLabel,
  onAppendToNotes
}) => {
  const { config } = useConfig();
  const [generated, setGenerated] = React.useState('');
  const [busy, setBusy] = React.useState(false);
  const [failed, setFailed] = React.useState(false);
  const [appended, setAppended] = React.useState(false);
  const [nonce, setNonce] = React.useState(0);
  const requestGenRef = React.useRef(0);

  React.useEffect(() => {
    const apiKey = (config.geminiApiKey || '').trim();
    if (!apiKey || !placeLabel.trim()) {
      setFailed(true);
      setGenerated('');
      setBusy(false);
      return;
    }

    const gen = ++requestGenRef.current;
    let cancelled = false;
    setBusy(true);
    setFailed(false);
    setAppended(false);

    const near = startingPointLabel ? ` near ${startingPointLabel}` : '';
    const cat = categoryLabel ? ` focusing on ${categoryLabel}` : '';
    const prompt = `Write ONE short practical travel tip (max 28 words) for a visitor to ${placeLabel}${near}${cat}. Make it specific and different from generic advice. No quotes, no markdown, no emoji.`;

    void (async () => {
      try {
        const model = 'gemini-2.0-flash';
        const url = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent?key=${encodeURIComponent(apiKey)}`;
        const resp = await fetch(url, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            contents: [{ parts: [{ text: prompt }] }],
            generationConfig: { temperature: 0.85, maxOutputTokens: 80 }
          })
        });
        if (!resp.ok) throw new Error(`Gemini ${resp.status}`);
        const data = (await resp.json()) as {
          candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }>;
        };
        const text = firstSentence(
          (data.candidates?.[0]?.content?.parts?.[0]?.text || '').trim().replace(/^["']|["']$/g, '')
        );
        if (cancelled || gen !== requestGenRef.current) return;
        if (!text) {
          setFailed(true);
          setGenerated('');
          return;
        }
        setGenerated(text);
        setFailed(false);
      } catch {
        if (!cancelled && gen === requestGenRef.current) {
          setGenerated('');
          setFailed(true);
        }
      } finally {
        if (!cancelled && gen === requestGenRef.current) setBusy(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [placeLabel, categoryLabel, startingPointLabel, config.geminiApiKey, nonce]);

  const tip =
    generated ||
    (busy ? 'Getting a tip…' : '') ||
    (failed
      ? `Carry small change or a transit card for ${placeLabel || 'this area'}, and download offline maps before you go.`
      : 'Getting a tip…');

  const canUseTip = Boolean(generated) && !busy;

  return (
    <section className={styles.root} aria-label="Travel tip">
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
            {onAppendToNotes ? (
              <button
                type="button"
                className={styles.actionBtn}
                onClick={() => {
                  if (!canUseTip) return;
                  onAppendToNotes(generated);
                  setAppended(true);
                  window.setTimeout(() => setAppended(false), 2000);
                }}
                disabled={!canUseTip}
                aria-label="Add tip to notes"
                title="Add tip to notes"
              >
                <IconAppend />
              </button>
            ) : null}
          </div>
        </div>
        <p className={styles.text}>{tip}</p>
        {appended ? <p className={styles.feedback}>Added to Notes</p> : null}
      </div>
    </section>
  );
};
