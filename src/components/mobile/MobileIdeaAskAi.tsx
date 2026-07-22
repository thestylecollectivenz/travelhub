import * as React from 'react';
import { useConfig } from '../../context/ConfigContext';
import { useTripPermissions } from '../../hooks/useTripPermissions';
import { answerTravelChat } from '../../services/GeminiService';
import { formatGeminiUserMessage } from '../../services/geminiErrorMessage';
import { useSpeechOutput } from '../../hooks/useSpeechOutput';
import { useContinuousSpeechInput } from '../../hooks/useContinuousSpeechInput';
import { SpeechPlaybackControls } from '../shared/SpeechPlaybackControls';
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
  dayLabel?: string;
  thread: IdeaQaEntry[];
  onThreadChange: (next: IdeaQaEntry[]) => void | Promise<void>;
  compact?: boolean;
}

function newQaId(): string {
  return `idea-qa-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

export const MobileIdeaAskAi: React.FC<MobileIdeaAskAiProps> = ({
  ideaText,
  locationLabel,
  dayLabel,
  thread,
  onThreadChange,
  compact
}) => {
  const { config } = useConfig();
  const { canUseAiHelpers } = useTripPermissions();
  const [open, setOpen] = React.useState(Boolean(thread.length));
  const [question, setQuestion] = React.useState('');
  const [busy, setBusy] = React.useState(false);
  const [error, setError] = React.useState('');
  const { speechState, speak, pause, resume, stop: stopSpeech } = useSpeechOutput();
  const appendVoice = React.useCallback((chunk: string) => {
    setQuestion((prev) => `${prev}${prev ? ' ' : ''}${chunk}`);
  }, []);
  const { listening, toggleListening, stopListening, supported } = useContinuousSpeechInput(appendVoice);

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
      const context = [
        `Trip idea: ${ideaText}`,
        dayLabel ? `Day: ${dayLabel}` : '',
        locationLabel ? `Location: ${locationLabel}` : ''
      ]
        .filter(Boolean)
        .join('\n');
      const { answer } = await answerTravelChat(key, [{ role: 'user', text: `${context}\n\nQuestion: ${q}` }]);
      const entry: IdeaQaEntry = {
        id: newQaId(),
        question: q,
        answer: (answer || '').trim(),
        createdAt: new Date().toISOString()
      };
      await onThreadChange([...thread, entry]);
      setQuestion('');
      if (entry.answer) speak(entry.answer);
    } catch (err) {
      setError(formatGeminiUserMessage(err));
    } finally {
      setBusy(false);
    }
  };

  const removeEntry = (id: string): void => {
    void onThreadChange(thread.filter((t) => t.id !== id));
  };

  return (
    <div className={`${styles.root} ${compact ? styles.compact : ''}`}>
      <button type="button" className={styles.toggle} onClick={() => setOpen((v) => !v)} aria-expanded={open}>
        <span aria-hidden>✦</span> Ask AI about this idea {open ? '▾' : '▸'}
        {thread.length ? <span className={styles.count}>{thread.length}</span> : null}
      </button>
      {open ? (
        <div className={styles.panel}>
          <div className={styles.inputRow}>
            <input
              className={styles.input}
              value={question}
              onChange={(e) => setQuestion(e.target.value)}
              placeholder="Ask a question about this idea…"
              aria-label="Ask AI about this idea"
              onKeyDown={(e) => {
                if (e.key === 'Enter') void ask();
              }}
            />
            <button
              type="button"
              className={`${styles.iconBtn} ${listening ? styles.iconBtnOn : ''}`}
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
          {thread.length ? (
            <ul className={styles.thread}>
              {thread.map((item) => (
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
