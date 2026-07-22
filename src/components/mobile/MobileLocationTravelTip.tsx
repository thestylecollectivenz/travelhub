import * as React from 'react';
import type { ItineraryEntry } from '../../models/ItineraryEntry';
import type { Place } from '../../models/Place';
import type { LocationInfoQaEntry, SavedTravelTip } from '../../utils/locationInfoEntry';
import { useConfig } from '../../context/ConfigContext';
import { useSpContext } from '../../context/SpContext';
import { GEMINI_MODEL_FALLBACK_CHAIN } from '../../services/GeminiService';
import { scheduleTravelTipQuestion } from '../../utils/locationInfoGeneration';
import { subscribeLocationInfoAIStatus } from '../../utils/locationInfoAIEvents';
import { useSpeechOutput } from '../../hooks/useSpeechOutput';
import { useContinuousSpeechInput } from '../../hooks/useContinuousSpeechInput';
import { SpeechPlaybackControls } from '../shared/SpeechPlaybackControls';
import { LinkifiedText } from '../shared/LinkifiedText';
import { RichTextContent } from '../shared/RichTextContent';
import { isLikelyJournalHtml, richTextToPlainText } from '../../utils/journalRichText';
import { qaEntryTitle } from '../../utils/qaDisplayText';
import { confirmUserAction } from '../../utils/confirmAction';
import styles from './MobileLocationTravelTip.module.css';

export interface MobileLocationTravelTipProps {
  placeLabel: string;
  categoryLabel?: string;
  startingPointLabel?: string;
  onSaveTip?: (tipText: string) => void;
  onDeleteTip?: (tipId: string) => void;
  savedTips?: SavedTravelTip[];
  showSavedList?: boolean;
  onCreateTaskFromTip?: (tipText: string) => void;
  onAddTipToItinerary?: (tipText: string) => void;
  /** Required for tip Q&A Ask AI. */
  entry?: ItineraryEntry;
  place?: Place;
  readOnly?: boolean;
  onTipsChange?: (tips: SavedTravelTip[]) => void;
  onCreateTaskFromTipQa?: (item: LocationInfoQaEntry) => void;
  onAddTipQaToItinerary?: (item: LocationInfoQaEntry) => void;
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
      <path d="M20 12a8 8 0 1 1-2.2-5.4" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
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

function IconInfo(): React.ReactElement {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" aria-hidden>
      <circle cx="12" cy="12" r="9" stroke="currentColor" strokeWidth="1.6" />
      <path d="M12 10.5v6M12 7.5h.01" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
    </svg>
  );
}

function IconMic({ active }: { active?: boolean }): React.ReactElement {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden>
      <rect x="9" y="3" width="6" height="11" rx="3" stroke="currentColor" strokeWidth="1.6" fill={active ? 'currentColor' : 'none'} />
      <path d="M6 11a6 6 0 0 0 12 0M12 17v3" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
    </svg>
  );
}

function SpeakerIcon(): React.ReactElement {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden>
      <path d="M3 10v4h4l5 4V6L7 10H3Z" fill="currentColor" />
      <path d="M16 9a4 4 0 0 1 0 6M18.5 7a7 7 0 0 1 0 10" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
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

const SavedTipCard: React.FC<{
  tip: SavedTravelTip;
  placeLabel: string;
  entry?: ItineraryEntry;
  place?: Place;
  readOnly?: boolean;
  onDeleteTip?: (tipId: string) => void;
  onCreateTaskFromTip?: (tipText: string) => void;
  onAddTipToItinerary?: (tipText: string) => void;
  onTipsChange?: (tips: SavedTravelTip[]) => void;
  allTips: SavedTravelTip[];
  onCreateTaskFromTipQa?: (item: LocationInfoQaEntry) => void;
  onAddTipQaToItinerary?: (item: LocationInfoQaEntry) => void;
}> = ({
  tip,
  placeLabel,
  entry,
  place,
  readOnly,
  onDeleteTip,
  onCreateTaskFromTip,
  onAddTipToItinerary,
  onTipsChange,
  allTips,
  onCreateTaskFromTipQa,
  onAddTipQaToItinerary
}) => {
  const { config } = useConfig();
  const spContext = useSpContext();
  const [askOpen, setAskOpen] = React.useState(Boolean(tip.qaThread?.length));
  const [question, setQuestion] = React.useState('');
  const [asking, setAsking] = React.useState(false);
  const [askError, setAskError] = React.useState<string | undefined>();
  const { speechState, speak, pause, resume, stop: stopSpeech } = useSpeechOutput();
  const appendVoice = React.useCallback((chunk: string) => {
    setQuestion((prev) => `${prev}${prev ? ' ' : ''}${chunk}`);
  }, []);
  const { listening, toggleListening, stopListening } = useContinuousSpeechInput(appendVoice);
  const thread = tip.qaThread ?? [];
  const canAsk = Boolean(entry && place && (config.geminiApiKey || '').trim() && !readOnly);

  React.useEffect(() => {
    if (!entry) return;
    return subscribeLocationInfoAIStatus(entry.id, (detail) => {
      if (detail.section !== 'tip-qa' || detail.tipId !== tip.id) return;
      setAsking(detail.loading);
      if (detail.error) setAskError(detail.error);
      else if (detail.success) {
        setAskError(undefined);
        setQuestion('');
        stopListening();
      }
    });
  }, [entry, tip.id, stopListening]);

  const ask = (q: string): void => {
    if (!entry || !place || !canAsk) return;
    const trimmed = q.trim();
    if (!trimmed) return;
    stopListening();
    setAskOpen(true);
    setAskError(undefined);
    scheduleTravelTipQuestion({
      spContext,
      entry,
      place,
      apiKey: config.geminiApiKey || '',
      tipId: tip.id,
      question: trimmed
    });
  };

  const findOutMore = (): void => {
    ask(
      `Tell me more about this travel tip for ${placeLabel}: "${tip.text}". Explain why it matters and give one practical detail a visitor should know.`
    );
  };

  const speakAnswer = (answer: string): void => {
    // Stop mic only — speakPlainText cancels any prior TTS (extra cancel breaks iOS gesture).
    stopListening();
    const plain = richTextToPlainText(answer).trim() || answer.trim();
    if (plain) speak(plain);
  };

  const updateThread = (next: LocationInfoQaEntry[]): void => {
    onTipsChange?.(allTips.map((t) => (t.id === tip.id ? { ...t, qaThread: next } : t)));
  };

  return (
    <li className={styles.savedItem}>
      <div className={styles.savedMain}>
        <span className={styles.savedText}>{tip.text}</span>
        <span className={styles.savedActions}>
          {canAsk ? (
            <button
              type="button"
              className={styles.savedIconBtn}
              aria-label="Find out more about this tip"
              title="Find out more"
              onClick={findOutMore}
            >
              <IconInfo />
            </button>
          ) : null}
          {onCreateTaskFromTip ? (
            <button
              type="button"
              className={styles.savedIconBtn}
              aria-label="Create task from tip"
              title="Create task / list"
              onClick={() => onCreateTaskFromTip(tip.text)}
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
              onClick={() => onAddTipToItinerary(tip.text)}
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
              onClick={() => onDeleteTip(tip.id)}
            >
              ×
            </button>
          ) : null}
        </span>
      </div>

      {canAsk || thread.length ? (
        <div className={styles.tipQa}>
          <button type="button" className={styles.tipQaToggle} onClick={() => setAskOpen((v) => !v)}>
            {askOpen ? 'Hide tip Q&A' : thread.length ? `Tip Q&A (${thread.length})` : 'Ask about this tip'}
          </button>
          {askOpen ? (
            <div className={styles.tipQaBody}>
              {thread.map((item) => (
                <div key={item.id} className={styles.tipQaEntry}>
                  <p className={styles.tipQaQ}>Q: {qaEntryTitle(item)}</p>
                  {isLikelyJournalHtml(item.answer) ? (
                    <div className={styles.tipQaA}>
                      <RichTextContent html={item.answer} />
                    </div>
                  ) : (
                    <div className={styles.tipQaA}>
                      <LinkifiedText text={item.answer} />
                    </div>
                  )}
                  <div className={styles.tipQaActions}>
                    <button
                      type="button"
                      className={styles.savedIconBtn}
                      onClick={() => speakAnswer(item.answer)}
                      aria-label="Read aloud"
                      title="Read aloud"
                    >
                      <SpeakerIcon />
                    </button>
                    <SpeechPlaybackControls
                      speechState={speechState}
                      onPause={pause}
                      onResume={resume}
                      onStop={stopSpeech}
                      buttonClassName={styles.savedIconBtn}
                    />
                    {onCreateTaskFromTipQa ? (
                      <button
                        type="button"
                        className={styles.savedIconBtn}
                        aria-label="Save to list"
                        title="Save to list"
                        onClick={() => onCreateTaskFromTipQa(item)}
                      >
                        <IconTask />
                      </button>
                    ) : null}
                    {onAddTipQaToItinerary ? (
                      <button
                        type="button"
                        className={styles.savedIconBtn}
                        aria-label="Add to itinerary"
                        title="Add to itinerary"
                        onClick={() => onAddTipQaToItinerary(item)}
                      >
                        <IconItinerary />
                      </button>
                    ) : null}
                    {!readOnly && onTipsChange ? (
                      <button
                        type="button"
                        className={styles.savedX}
                        aria-label="Delete answer"
                        title="Delete"
                        onClick={() => {
                          void (async () => {
                            if (!(await confirmUserAction('Delete this tip answer?'))) return;
                            updateThread(thread.filter((x) => x.id !== item.id));
                          })();
                        }}
                      >
                        ×
                      </button>
                    ) : null}
                  </div>
                </div>
              ))}
              {canAsk ? (
                <div className={styles.tipAskRow}>
                  <textarea
                    className={styles.tipAskInput}
                    rows={2}
                    value={question}
                    onChange={(e) => setQuestion(e.target.value)}
                    placeholder="Ask another question about this tip…"
                    disabled={asking}
                  />
                  <div className={styles.tipAskActions}>
                    <button
                      type="button"
                      className={`${styles.savedIconBtn} ${listening ? styles.micOn : ''}`}
                      onClick={() => toggleListening()}
                      aria-label={listening ? 'Stop microphone' : 'Dictate question'}
                      title={listening ? 'Stop microphone' : 'Dictate'}
                      disabled={asking}
                    >
                      <IconMic active={listening} />
                    </button>
                    <button
                      type="button"
                      className={styles.askSend}
                      disabled={asking || !question.trim()}
                      onClick={() => ask(question)}
                    >
                      {asking ? 'Asking…' : 'Ask'}
                    </button>
                  </div>
                  {askError ? <p className={styles.tipAskError}>{askError}</p> : null}
                </div>
              ) : null}
            </div>
          ) : null}
        </div>
      ) : null}
    </li>
  );
};

export const MobileLocationTravelTip: React.FC<MobileLocationTravelTipProps> = ({
  placeLabel,
  categoryLabel,
  startingPointLabel,
  onSaveTip,
  onDeleteTip,
  savedTips = [],
  showSavedList = false,
  onCreateTaskFromTip,
  onAddTipToItinerary,
  entry,
  place,
  readOnly,
  onTipsChange,
  onCreateTaskFromTipQa,
  onAddTipQaToItinerary
}) => {
  const { config } = useConfig();
  const [generated, setGenerated] = React.useState('');
  const [busy, setBusy] = React.useState(false);
  const [failed, setFailed] = React.useState(false);
  const [savedFlash, setSavedFlash] = React.useState(false);
  const [nonce, setNonce] = React.useState(0);
  const requestGenRef = React.useRef(0);
  const recentTipsRef = React.useRef<string[]>([]);
  const savedTipsKey = savedTips.map((t) => t.text.trim()).filter(Boolean).join('\n');
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
    const avoid = [...recentTipsRef.current, ...savedTipsRef.current.map((t) => t.text)]
      .filter(Boolean)
      .slice(-8)
      .map((t) => `- ${t}`)
      .join('\n');
    const prompt =
      `Write ONE short practical travel tip (max 28 words) for a visitor currently in ${placeLabel}${near}${cat}. ` +
      `The tip must be specific to ${placeLabel} — do not mention any other city or country. ` +
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
  const alreadySaved = savedTips.some((t) => t.text.trim().toLowerCase() === generated.trim().toLowerCase());

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
              <SavedTipCard
                key={t.id}
                tip={t}
                placeLabel={placeLabel}
                entry={entry}
                place={place}
                readOnly={readOnly}
                onDeleteTip={onDeleteTip}
                onCreateTaskFromTip={onCreateTaskFromTip}
                onAddTipToItinerary={onAddTipToItinerary}
                onTipsChange={onTipsChange}
                allTips={savedTips}
                onCreateTaskFromTipQa={onCreateTaskFromTipQa}
                onAddTipQaToItinerary={onAddTipQaToItinerary}
              />
            ))}
          </ul>
        </div>
      ) : null}
    </section>
  );
};
