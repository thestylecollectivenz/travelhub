import * as React from 'react';
import { useConfig } from '../../context/ConfigContext';
import { useTripPermissions } from '../../hooks/useTripPermissions';
import { answerLocationQuestion } from '../../services/GeminiService';
import { formatGeminiUserMessage } from '../../services/geminiErrorMessage';
import { useSpeechOutput } from '../../hooks/useSpeechOutput';
import { useContinuousSpeechInput } from '../../hooks/useContinuousSpeechInput';
import { SpeechPlaybackControls } from '../shared/SpeechPlaybackControls';
import { placeNameFromTitle } from '../../utils/placeDisplayLabel';
import styles from './MobileIdeaAskAi.module.css';

export interface IdeaQaEntry {
  id: string;
  question: string;
  answer: string;
  createdAt: string;
}

export interface MobileIdeaAskAiProps {
  ideaText: string;
  locationLabel?: string;
  /** Overnight base for the day (hotel/cruise) — hotels only apply here. */
  overnightLabel?: string;
  dayLabel?: string;
  thread: IdeaQaEntry[];
  onThreadChange: (next: IdeaQaEntry[]) => void | Promise<void>;
  compact?: boolean;
}

function newQaId(): string {
  return `idea-qa-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

/** Match location-info Q&A: no markdown asterisks / focus preamble in stored answers. */
export function sanitizeIdeaAiAnswer(raw: string): string {
  let text = (raw || '').trim();
  text = text.replace(/^CURRENT FOCUS:.*$/gim, '');
  text = text.replace(/^Latest traveller message:.*$/gim, '');
  text = text.replace(/\*\*([^*]+)\*\*/g, '$1');
  text = text.replace(/\*([^*\n]+)\*/g, '$1');
  text = text.replace(/^#{1,6}\s+/gm, '');
  text = text.replace(/`([^`]+)`/g, '$1');
  return text.replace(/\n{3,}/g, '\n\n').trim();
}

export const MobileIdeaAskAi: React.FC<MobileIdeaAskAiProps> = ({
  ideaText,
  locationLabel,
  overnightLabel,
  dayLabel,
  thread,
  onThreadChange,
  compact
}) => {
  const { config } = useConfig();
  const { canUseAiHelpers } = useTripPermissions();
  const [open, setOpen] = React.useState(Boolean(thread.length));
  const [localThread, setLocalThread] = React.useState(thread);
  const [question, setQuestion] = React.useState('');
  const [busy, setBusy] = React.useState(false);
  const [error, setError] = React.useState('');
  const { speechState, speak, pause, resume, stop: stopSpeech } = useSpeechOutput();
  const appendVoice = React.useCallback((chunk: string) => {
    setQuestion((prev) => `${prev}${prev ? ' ' : ''}${chunk}`);
  }, []);
  const { listening, toggleListening, stopListening, supported } = useContinuousSpeechInput(appendVoice);

  React.useEffect(() => {
    setLocalThread(thread);
  }, [thread]);

  if (!canUseAiHelpers) return null;

  const ask = async (raw?: string): Promise<void> => {
    const q = (raw ?? question).trim();
    if (!q || busy) return;
    const key = (config.geminiApiKey || '').trim();
    if (!key) {
      setError('Add a Gemini API key in settings to ask about ideas.');
      return;
    }
    setBusy(true);
    setError('');
    stopListening();
    setOpen(true);
    try {
      const placeLabel = (locationLabel || '').trim();
      const placeName = placeNameFromTitle(placeLabel) || placeLabel || 'this trip';
      const country =
        placeLabel.includes(',')
          ? placeLabel
              .split(',')
              .map((p) => p.trim())
              .filter(Boolean)
              .slice(-1)[0] || ''
          : '';
      const contextSummary = [
        `Trip idea: ${ideaText}`,
        dayLabel ? `Day / date: ${dayLabel}` : '',
        overnightLabel
          ? `Overnight base (where we sleep that night — hotel/cruise only if listed): ${overnightLabel}`
          : 'Overnight base: not listed for this day yet',
        placeLabel
          ? `Idea / visit place (day visit — do NOT assume a hotel here unless listed): ${placeLabel}`
          : '',
        'Rule: Hotels and cruise cabins apply only to overnight stays. Day trips use the overnight base; do not mention missing hotels at day-visit places.'
      ]
        .filter(Boolean)
        .join('\n');
      // Same Q&A path as location-info pages (plain JSON answer, no CURRENT FOCUS / markdown).
      const { answer } = await answerLocationQuestion(placeName, country || 'unknown', q, {
        apiKey: key,
        contextSummary
      });
      const entry: IdeaQaEntry = {
        id: newQaId(),
        question: q,
        answer: sanitizeIdeaAiAnswer(answer || ''),
        createdAt: new Date().toISOString()
      };
      const next = [...localThread, entry];
      setLocalThread(next);
      setQuestion('');
      try {
        await onThreadChange(next);
      } catch (err) {
        setError(
          err instanceof Error
            ? err.message
            : 'Answer received but could not save. Wait a moment and try again.'
        );
      }
      if (entry.answer) speak(entry.answer);
    } catch (err) {
      setError(formatGeminiUserMessage(err));
    } finally {
      setBusy(false);
    }
  };

  const removeEntry = (id: string): void => {
    const next = localThread.filter((t) => t.id !== id);
    setLocalThread(next);
    void onThreadChange(next);
  };

  return (
    <div className={`${styles.root} ${compact ? styles.compact : ''}`}>
      <button type="button" className={styles.toggle} onClick={() => setOpen((v) => !v)} aria-expanded={open}>
        <span aria-hidden>✦</span> Ask AI about this idea {open ? '▾' : '▸'}
        {localThread.length ? <span className={styles.count}>{localThread.length}</span> : null}
      </button>
      {open ? (
        <div className={styles.panel}>
          <div className={styles.inputRow}>
            <input
              className={styles.input}
              value={question}
              onChange={(e) => setQuestion(e.target.value)}
              placeholder="Ask anything about this idea…"
              aria-label="Ask about this idea"
              onKeyDown={(e) => {
                if (e.key === 'Enter') void ask();
              }}
            />
            <button
              type="button"
              className={`${styles.iconBtn} ${listening ? styles.iconBtnOn : ''}`}
              disabled={!supported}
              onClick={() => {
                if (!supported) {
                  setError('Microphone dictation is not available in this browser.');
                  return;
                }
                toggleListening();
              }}
              aria-label={listening ? 'Stop microphone' : 'Dictate question'}
              title={supported ? (listening ? 'Stop' : 'Dictate') : 'Speech not supported'}
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" aria-hidden>
                <rect x="9" y="3" width="6" height="11" rx="3" stroke="currentColor" strokeWidth="1.8" />
                <path d="M6 11a6 6 0 0 0 12 0M12 17v4" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
              </svg>
            </button>
            <button type="button" className={styles.askBtn} disabled={busy || !question.trim()} onClick={() => void ask()}>
              Ask
            </button>
          </div>
          {error ? <p className={styles.error}>{error}</p> : null}
          {busy ? <p className={styles.muted}>Thinking…</p> : null}
          {localThread.length ? (
            <ul className={styles.thread}>
              {localThread.map((item) => (
                <li key={item.id} className={styles.threadItem}>
                  <p className={styles.q}>
                    <strong>Q:</strong> {item.question}
                  </p>
                  <p className={styles.a}>
                    <strong>A:</strong> {item.answer}
                  </p>
                  <div className={styles.threadActions}>
                    <button type="button" className={styles.smallBtn} onClick={() => speak(item.answer)}>
                      Listen
                    </button>
                    <SpeechPlaybackControls
                      speechState={speechState}
                      onPause={pause}
                      onResume={resume}
                      onStop={stopSpeech}
                      className={styles.playback}
                      buttonClassName={styles.smallBtn}
                    />
                    <button type="button" className={styles.smallBtn} onClick={() => removeEntry(item.id)}>
                      Delete
                    </button>
                  </div>
                </li>
              ))}
            </ul>
          ) : null}
        </div>
      ) : null}
    </div>
  );
};
