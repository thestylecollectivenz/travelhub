import * as React from 'react';
import { useConfig } from '../../context/ConfigContext';
import { useTripPermissions } from '../../hooks/useTripPermissions';
import { answerLocationQuestion } from '../../services/GeminiService';
import { formatGeminiUserMessage } from '../../services/geminiErrorMessage';
import { useSpeechOutput } from '../../hooks/useSpeechOutput';
import { useContinuousSpeechInput } from '../../hooks/useContinuousSpeechInput';
import { SpeechPlaybackControls } from '../shared/SpeechPlaybackControls';
import { placeNameFromTitle } from '../../utils/placeDisplayLabel';
import { confirmUserAction } from '../../utils/confirmAction';
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
  onCreateTask?: (item: IdeaQaEntry) => void;
  onAddToItinerary?: (item: IdeaQaEntry) => void;
  subjectLabel?: string;
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

const SpeakerIcon: React.FC<{ size?: number }> = ({ size = 18 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" aria-hidden>
    <path d="M3 10v4h4l5 4V6L7 10H3Z" fill="currentColor" />
    <path
      d="M16 9a4 4 0 0 1 0 6M18.5 7a7 7 0 0 1 0 10"
      stroke="currentColor"
      strokeWidth="1.6"
      strokeLinecap="round"
    />
  </svg>
);

export const MobileIdeaAskAi: React.FC<MobileIdeaAskAiProps> = ({
  ideaText,
  locationLabel,
  overnightLabel,
  dayLabel,
  thread,
  onThreadChange,
  compact,
  onCreateTask,
  onAddToItinerary,
  subjectLabel = 'idea'
}) => {
  const { config } = useConfig();
  const { canUseAiHelpers } = useTripPermissions();
  const [open, setOpen] = React.useState(Boolean(thread.length));
  const [localThread, setLocalThread] = React.useState(thread);
  const [question, setQuestion] = React.useState('');
  const [busy, setBusy] = React.useState(false);
  const [error, setError] = React.useState('');
  const [editingId, setEditingId] = React.useState<string | null>(null);
  const [editQuestionDraft, setEditQuestionDraft] = React.useState('');
  const [editAnswerDraft, setEditAnswerDraft] = React.useState('');
  const [autoReadAnswers, setAutoReadAnswers] = React.useState(false);
  const lastReadIdRef = React.useRef<string | undefined>();
  const { speechState, speak, pause, resume, stop: stopSpeech } = useSpeechOutput();
  const appendVoice = React.useCallback((chunk: string) => {
    setQuestion((prev) => `${prev}${prev ? ' ' : ''}${chunk}`);
  }, []);
  const { listening, toggleListening, stopListening, supported } = useContinuousSpeechInput(appendVoice);

  React.useEffect(() => {
    setLocalThread(thread);
  }, [thread]);

  React.useEffect(() => {
    if (!autoReadAnswers) return;
    const last = localThread[localThread.length - 1];
    if (!last || last.id === lastReadIdRef.current) return;
    lastReadIdRef.current = last.id;
    const plain = (last.answer || '').trim();
    if (plain) {
      stopListening();
      speak(plain);
    }
  }, [autoReadAnswers, localThread, speak, stopListening]);

  if (!canUseAiHelpers) return null;

  const updateThread = (next: IdeaQaEntry[]): void => {
    setLocalThread(next);
    void onThreadChange(next);
  };

  const speakAnswer = (answer: string): void => {
    stopListening();
    const plain = (answer || '').trim();
    if (plain) speak(plain);
  };

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
      const priorThreadBits =
        localThread.length > 0
          ? `Earlier idea Q&A:\n${localThread
              .map((x) => `Q: ${x.question}\nA: ${x.answer}`)
              .join('\n')}\nAnswer the follow-up in the context of this thread — do not require the traveller to restate prior details.`
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
        'Rule: Hotels and cruise cabins apply only to overnight stays. Day trips use the overnight base; do not mention missing hotels at day-visit places.',
        priorThreadBits
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
      // Do not auto-speak — user taps Listen when they want audio.
    } catch (err) {
      setError(formatGeminiUserMessage(err));
    } finally {
      setBusy(false);
    }
  };

  const removeEntry = async (id: string): Promise<void> => {
    if (!(await confirmUserAction('Delete this Q&A entry?'))) return;
    updateThread(localThread.filter((t) => t.id !== id));
  };

  return (
    <div className={`${styles.root} ${compact ? styles.compact : ''}`}>
      <button type="button" className={styles.toggle} onClick={() => setOpen((v) => !v)} aria-expanded={open}>
        <span aria-hidden>✦</span> Ask AI about this {subjectLabel} {open ? '▾' : '▸'}
        {localThread.length ? <span className={styles.count}>{localThread.length}</span> : null}
      </button>
      {open ? (
        <div className={styles.panel}>
          <div className={styles.inputRow}>
            <input
              className={styles.input}
              value={question}
              onChange={(e) => setQuestion(e.target.value)}
              placeholder={`Ask anything about this ${subjectLabel}…`}
              aria-label={`Ask about this ${subjectLabel}`}
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
              {listening ? (
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" aria-hidden>
                  <rect x="6" y="6" width="12" height="12" rx="2" fill="currentColor" />
                </svg>
              ) : (
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" aria-hidden>
                  <rect x="9" y="3" width="6" height="11" rx="3" stroke="currentColor" strokeWidth="1.8" />
                  <path d="M6 11a6 6 0 0 0 12 0M12 17v4" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
                </svg>
              )}
            </button>
            <button type="button" className={styles.askBtn} disabled={busy || !question.trim()} onClick={() => void ask()}>
              Ask
            </button>
          </div>
          <label className={styles.voiceToggle}>
            <input
              type="checkbox"
              checked={autoReadAnswers}
              onChange={(e) => {
                const on = e.target.checked;
                if (on) lastReadIdRef.current = localThread[localThread.length - 1]?.id;
                setAutoReadAnswers(on);
              }}
            />
            Read new answers aloud
          </label>
          {error ? <p className={styles.error}>{error}</p> : null}
          {busy ? <p className={styles.muted}>Thinking…</p> : null}
          {localThread.length ? (
            <ul className={styles.thread}>
              {localThread.map((item) => (
                <li key={item.id} className={styles.threadItem}>
                  {editingId === item.id ? (
                    <div className={styles.editStack}>
                      <label className={styles.editLabel} htmlFor={`idea-qa-q-${item.id}`}>
                        Question
                      </label>
                      <textarea
                        id={`idea-qa-q-${item.id}`}
                        className={styles.editArea}
                        rows={2}
                        value={editQuestionDraft}
                        onChange={(e) => setEditQuestionDraft(e.target.value)}
                      />
                      <label className={styles.editLabel} htmlFor={`idea-qa-a-${item.id}`}>
                        Answer
                      </label>
                      <textarea
                        id={`idea-qa-a-${item.id}`}
                        className={styles.editArea}
                        rows={4}
                        value={editAnswerDraft}
                        onChange={(e) => setEditAnswerDraft(e.target.value)}
                      />
                    </div>
                  ) : (
                    <>
                      <p className={styles.q}>
                        <strong>Q:</strong> {item.question}
                      </p>
                      <p className={styles.a}>
                        <strong>A:</strong> {item.answer}
                      </p>
                    </>
                  )}
                  <div className={styles.threadActions}>
                    {editingId === item.id ? (
                      <>
                        <button
                          type="button"
                          className={styles.iconBtn}
                          aria-label="Save"
                          title="Save"
                          onClick={() => {
                            const nextQ = editQuestionDraft.trim();
                            const nextA = editAnswerDraft.trim();
                            if (!nextQ || !nextA) return;
                            updateThread(
                              localThread.map((t) =>
                                t.id === item.id ? { ...t, question: nextQ, answer: nextA } : t
                              )
                            );
                            setEditingId(null);
                          }}
                        >
                          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden>
                            <path
                              d="M5 12.5 9.5 17 19 7.5"
                              stroke="currentColor"
                              strokeWidth="2"
                              strokeLinecap="round"
                              strokeLinejoin="round"
                            />
                          </svg>
                        </button>
                        <button
                          type="button"
                          className={styles.iconBtn}
                          aria-label="Cancel"
                          title="Cancel"
                          onClick={() => {
                            setEditingId(null);
                            setEditQuestionDraft('');
                            setEditAnswerDraft('');
                          }}
                        >
                          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden>
                            <path d="M6 6l12 12M18 6 6 18" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
                          </svg>
                        </button>
                      </>
                    ) : (
                      <>
                        {item.answer?.trim() ? (
                          <button
                            type="button"
                            className={styles.iconBtn}
                            onClick={() => speakAnswer(item.answer)}
                            aria-label="Read this answer aloud"
                            title="Listen"
                          >
                            <SpeakerIcon size={16} />
                          </button>
                        ) : null}
                        <SpeechPlaybackControls
                          speechState={speechState}
                          onPause={pause}
                          onResume={resume}
                          onStop={stopSpeech}
                          className={styles.playback}
                          buttonClassName={styles.smallBtn}
                        />
                        <button
                          type="button"
                          className={styles.iconBtn}
                          aria-label="Edit"
                          title="Edit"
                          onClick={() => {
                            setEditingId(item.id);
                            setEditQuestionDraft(item.question);
                            setEditAnswerDraft(item.answer);
                          }}
                        >
                          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden>
                            <path
                              d="M4 20h4l10.5-10.5a2.1 2.1 0 0 0-3-3L5 17v3Z"
                              stroke="currentColor"
                              strokeWidth="1.7"
                              strokeLinejoin="round"
                            />
                            <path d="M12.5 7.5l3 3" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" />
                          </svg>
                        </button>
                        {onCreateTask ? (
                          <button
                            type="button"
                            className={styles.iconBtn}
                            aria-label="Create task"
                            title="Create task"
                            onClick={() => onCreateTask(item)}
                          >
                            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden>
                              <path
                                d="M9 11.5 11 13.5 15.5 9"
                                stroke="currentColor"
                                strokeWidth="1.7"
                                strokeLinecap="round"
                                strokeLinejoin="round"
                              />
                              <rect x="4" y="4" width="16" height="16" rx="2" stroke="currentColor" strokeWidth="1.6" />
                            </svg>
                          </button>
                        ) : null}
                        {onAddToItinerary ? (
                          <button
                            type="button"
                            className={styles.iconBtn}
                            aria-label="Add to itinerary"
                            title="Add to itinerary"
                            onClick={() => onAddToItinerary(item)}
                          >
                            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden>
                              <path d="M12 5v14M5 12h14" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
                            </svg>
                          </button>
                        ) : null}
                        <button
                          type="button"
                          className={`${styles.iconBtn} ${styles.iconBtnDanger}`}
                          aria-label="Delete"
                          title="Delete"
                          onClick={() => void removeEntry(item.id)}
                        >
                          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden>
                            <path
                              d="M5 7h14M10 7V5h4v2m-6 3v8m4-8v8M7 7l1 13h8l1-13"
                              stroke="currentColor"
                              strokeWidth="1.7"
                              strokeLinecap="round"
                              strokeLinejoin="round"
                            />
                          </svg>
                        </button>
                      </>
                    )}
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
