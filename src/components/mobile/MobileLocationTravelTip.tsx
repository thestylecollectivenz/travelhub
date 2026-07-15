import * as React from 'react';
import { useConfig } from '../../context/ConfigContext';
import { richTextToPlainText } from '../../utils/journalRichText';
import styles from './MobileLocationTravelTip.module.css';

export interface MobileLocationTravelTipProps {
  placeLabel: string;
  /** Existing tip HTML/plain from location notes (preferred when present). */
  existingTipHtml?: string;
  categoryLabel?: string;
  startingPointLabel?: string;
}

const TIP_CACHE_PREFIX = 'travelhub-travel-tip:';

function cacheKey(place: string, category?: string, start?: string): string {
  return `${TIP_CACHE_PREFIX}${place}|${category || ''}|${start || ''}`;
}

function firstSentence(text: string): string {
  const t = text.trim();
  if (!t) return '';
  return t.split(/(?<=[.!?])\s+/)[0] || t;
}

/**
 * Compact AI travel tip strip for location / explore / saved bottoms.
 * Prefers existing practical tips; otherwise generates a short tip once and caches it.
 */
export const MobileLocationTravelTip: React.FC<MobileLocationTravelTipProps> = ({
  placeLabel,
  existingTipHtml,
  categoryLabel,
  startingPointLabel
}) => {
  const { config } = useConfig();
  const existing = firstSentence(richTextToPlainText(existingTipHtml || ''));
  const [generated, setGenerated] = React.useState('');
  const [busy, setBusy] = React.useState(false);
  const requestedRef = React.useRef('');

  React.useEffect(() => {
    if (existing) return;
    const key = cacheKey(placeLabel, categoryLabel, startingPointLabel);
    try {
      const cached = window.sessionStorage.getItem(key);
      if (cached) {
        setGenerated(cached);
        return;
      }
    } catch {
      /* ignore */
    }

    const apiKey = (config.geminiApiKey || '').trim();
    if (!apiKey || !placeLabel.trim()) return;
    if (requestedRef.current === key) return;
    requestedRef.current = key;

    let cancelled = false;
    setBusy(true);
    const near = startingPointLabel ? ` near ${startingPointLabel}` : '';
    const cat = categoryLabel ? ` focusing on ${categoryLabel}` : '';
    const prompt = `Write ONE short practical travel tip (max 28 words) for a visitor to ${placeLabel}${near}${cat}. No quotes, no markdown, no emoji.`;

    void (async () => {
      try {
        const model = 'gemini-2.0-flash';
        const url = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent?key=${encodeURIComponent(apiKey)}`;
        const resp = await fetch(url, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            contents: [{ parts: [{ text: prompt }] }],
            generationConfig: { temperature: 0.4, maxOutputTokens: 80 }
          })
        });
        if (!resp.ok) throw new Error(`Gemini ${resp.status}`);
        const data = (await resp.json()) as {
          candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }>;
        };
        const text = (data.candidates?.[0]?.content?.parts?.[0]?.text || '').trim().replace(/^["']|["']$/g, '');
        if (!text || cancelled) return;
        setGenerated(text);
        try {
          window.sessionStorage.setItem(key, text);
        } catch {
          /* ignore */
        }
      } catch {
        if (!cancelled) setGenerated('');
      } finally {
        if (!cancelled) setBusy(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [placeLabel, categoryLabel, startingPointLabel, existing, config.geminiApiKey]);

  const tip = existing || generated;
  if (!tip && !busy) return null;

  return (
    <section className={styles.root} aria-label="Travel tip">
      <div className={styles.icon} aria-hidden>
        ✦
      </div>
      <div className={styles.body}>
        <h3 className={styles.title}>Travel tip</h3>
        <p className={styles.text}>{busy && !tip ? 'Getting a tip…' : tip}</p>
      </div>
    </section>
  );
};
