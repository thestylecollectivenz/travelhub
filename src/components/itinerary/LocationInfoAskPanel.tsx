import * as React from 'react';
import type { ItineraryEntry } from '../../models/ItineraryEntry';
import type { Place } from '../../models/Place';
import type { LocationInfoNotes, LocationInfoQaEntry } from '../../utils/locationInfoEntry';
import { useSpContext } from '../../context/SpContext';
import { subscribeLocationInfoAIStatus } from '../../utils/locationInfoAIEvents';
import { scheduleLocationInfoQuestion } from '../../utils/locationInfoGeneration';
import { LinkifiedText } from '../shared/LinkifiedText';
import { RichTextContent } from '../shared/RichTextContent';
import { isLikelyJournalHtml, richTextToPlainText } from '../../utils/journalRichText';
import { confirmUserAction } from '../../utils/confirmAction';
import { useSpeechOutput } from '../../hooks/useSpeechOutput';
import { useContinuousSpeechInput } from '../../hooks/useContinuousSpeechInput';
import { SpeechPlaybackControls } from '../shared/SpeechPlaybackControls';
import styles from './LocationInfoAskPanel.module.css';

export interface LocationInfoAskPanelProps {
  entry: ItineraryEntry;
  place: Place | undefined;
  data: LocationInfoNotes;
  geminiApiKey: string;
  readOnly?: boolean;
  mobileLayout?: boolean;
  hideIntro?: boolean;
  onOpenSettings?: () => void;
  onThreadChange?: (thread: LocationInfoQaEntry[]) => void;
}

export const LocationInfoAskPanel: React.FC<LocationInfoAskPanelProps> = ({
  entry,
  place,
  data,
  geminiApiKey,
  readOnly = false,
  mobileLayout = false,
  hideIntro = false,
  onOpenSettings,
  onThreadChange
}) => {
  const spContext = useSpContext();
  const [question, setQuestion] = React.useState('');
  const [asking, setAsking] = React.useState(false);
  const [askError, setAskError] = React.useState<string | undefined>();
  const [editingId, setEditingId] = React.useState<string | null>(null);
  const [editQuestionDraft, setEditQuestionDraft] = React.useState('');
  const [editAnswerDraft, setEditAnswerDraft] = React.useState('');
  const [voiceError, setVoiceError] = React.useState<string | undefined>();
  const [autoReadAnswers, setAutoReadAnswers] = React.useState(false);
  const [expandedIds, setExpandedIds] = React.useState<Set<string>>(() => new Set());
  const { speechState, speak, pause, resume, stop: stopSpeech } = useSpeechOutput();
  const appendVoiceInput = React.useCallback((chunk: string) => {
    setQuestion((prev) => `${prev}${prev ? ' ' : ''}${chunk}`);
  }, []);
  const { listening: voiceListening, toggleListening: toggleVoiceInput, stopListening: stopVoiceInput } =
    useContinuousSpeechInput(appendVoiceInput);

  const hasKey = Boolean((geminiApiKey || '').trim());
  const thread = data.aiQaThread ?? [];

  React.useEffect(() => {
    return subscribeLocationInfoAIStatus(entry.id, (detail) => {
      if (detail.section !== 'qa') return;
      setAsking(detail.loading);
      if (detail.error) {
        setAskError(detail.error);
      } else if (detail.success) {
        setAskError(undefined);
        setQuestion('');
        stopVoiceInput();
      }
    });
  }, [entry.id, stopVoiceInput]);

  React.useEffect(() => {
    if (!thread.length) return;
    setExpandedIds((prev) => {
      const next = new Set(prev);
      const last = thread[thread.length - 1];
      if (last) next.add(last.id);
      return next;
    });
  }, [thread.length, thread]);

  const lastReadIdRef = React.useRef<string | undefined>();
  React.useEffect(() => {
    if (!autoReadAnswers) return;
    const last = thread[thread.length - 1];
    if (!last?.answer?.trim() || last.id === lastReadIdRef.current) return;
    lastReadIdRef.current = last.id;
    speak(richTextToPlainText(last.answer));
  }, [autoReadAnswers, thread, speak]);

  const updateThread = (next: LocationInfoQaEntry[]): void => {
    onThreadChange?.(next);
  };

  const submitQuestion = (): void => {
    if (!place || !hasKey || readOnly) return;
    const q = question.trim();
    if (!q) return;
    stopVoiceInput();
    setAskError(undefined);
    scheduleLocationInfoQuestion({
      spContext,
      entry,
      place,
      apiKey: geminiApiKey,
      question: q
    });
  };

  const speakAnswer = (answer: string): void => {
    speak(richTextToPlainText(answer));
  };

  const toggleExpanded = (id: string): void => {
    setExpandedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  if (readOnly && !thread.length) {
    return null;
  }

  return (
    <section className={`${styles.root} ${mobileLayout ? styles.mobileRoot : ''}`} aria-label="Ask about this place">
      {!hideIntro ? (
      <h4 className={styles.intro}>
        Ask AI about this place (separate from highlights and overview). Answers are saved here and never overwrite your
        lists.
      </h4>
      ) : (
        <p className={styles.mobileIntro}>
          Ask AI about this place. Answers are saved here and never overwrite your lists.
        </p>
      )}
      {thread.length ? (
        <div className={styles.thread}>
          {thread.map((item) => {
            const expanded = expandedIds.has(item.id);
            return (
              <section key={item.id} className={styles.qaSection}>
                <button
                  type="button"
                  className={styles.qaToggle}
                  aria-expanded={expanded}
                  onClick={() => toggleExpanded(item.id)}
                >
                  <span className={styles.qaToggleLabel}>Q: {item.question}</span>
                  <span className={styles.qaChevron} aria-hidden>
                    {expanded ? '▾' : '▸'}
                  </span>
                </button>
                {expanded ? (
                  <div className={styles.qaBody}>
                    {editingId === item.id ? (
                      <div className={styles.editStack}>
                        <label className={styles.editLabel} htmlFor={`qa-q-edit-${item.id}`}>
                          Question
                        </label>
                        <textarea
                          id={`qa-q-edit-${item.id}`}
                          className={styles.editArea}
                          rows={2}
                          value={editQuestionDraft}
                          onChange={(e) => setEditQuestionDraft(e.target.value)}
                        />
                        <label className={styles.editLabel} htmlFor={`qa-a-edit-${item.id}`}>
                          Answer
                        </label>
                        <textarea
                          id={`qa-a-edit-${item.id}`}
                          className={styles.editArea}
                          rows={5}
                          value={editAnswerDraft}
                          onChange={(e) => setEditAnswerDraft(e.target.value)}
                        />
                      </div>
                    ) : isLikelyJournalHtml(item.answer) ? (
                      <div className={styles.answer}>
                        <RichTextContent html={item.answer} />
                      </div>
                    ) : (
                      <div className={styles.answer}>
                        <LinkifiedText text={item.answer} />
                      </div>
                    )}
                    {!readOnly && onThreadChange ? (
                      <div className={styles.qaActions}>
                        <button
                          type="button"
                          className={styles.iconBtn}
                          onClick={() => speakAnswer(item.answer)}
                          aria-label="Read aloud"
                          title="Read aloud"
                        >
                          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden>
                            <path d="M8 5.5v13l11-6.5L8 5.5Z" fill="currentColor" />
                          </svg>
                        </button>
                        <SpeechPlaybackControls
                          speechState={speechState}
                          onPause={pause}
                          onResume={resume}
                          onStop={stopSpeech}
                          buttonClassName={styles.qaBtn}
                        />
                        {editingId === item.id ? (
                          <>
                            <button
                              type="button"
                              className={styles.qaBtn}
                              onClick={() => {
                                const question = editQuestionDraft.trim();
                                const answer = editAnswerDraft.trim();
                                if (!question || !answer) return;
                                updateThread(
                                  thread.map((t) => (t.id === item.id ? { ...t, question, answer } : t))
                                );
                                setEditingId(null);
                              }}
                            >
                              Save
                            </button>
                            <button
                              type="button"
                              className={styles.qaBtn}
                              onClick={() => {
                                setEditingId(null);
                                setEditQuestionDraft('');
                                setEditAnswerDraft('');
                              }}
                            >
                              Cancel
                            </button>
                          </>
                        ) : (
                          <>
                            <button
                              type="button"
                              className={styles.qaBtn}
                              onClick={() => {
                                setEditingId(item.id);
                                setEditQuestionDraft(item.question);
                                setEditAnswerDraft(richTextToPlainText(item.answer));
                              }}
                            >
                              Edit
                            </button>
                            <button
                              type="button"
                              className={styles.qaBtnDanger}
                              onClick={() => {
                                void (async () => {
                                  if (!(await confirmUserAction('Delete this Q&A entry?'))) return;
                                  updateThread(thread.filter((t) => t.id !== item.id));
                                })();
                              }}
                            >
                              Delete
                            </button>
                          </>
                        )}
                      </div>
                    ) : null}
                  </div>
                ) : null}
              </section>
            );
          })}
        </div>
      ) : null}
      {!readOnly ? (
        <div className={styles.askSection}>
          <label className={styles.askLabel} htmlFor={`ask-q-${entry.id}`}>
            Your question
          </label>
          <textarea
            id={`ask-q-${entry.id}`}
            className={styles.askInput}
            rows={3}
            value={question}
            onChange={(e) => setQuestion(e.target.value)}
            placeholder="Ask anything about this place…"
          />
          <div className={styles.askActions}>
            <button
              type="button"
              className={styles.iconBtn}
              disabled={asking || !hasKey || !place}
              aria-label={voiceListening ? 'Stop listening' : 'Voice input'}
              title={voiceListening ? 'Stop listening' : 'Voice input'}
              onClick={() => {
                if (voiceListening) stopVoiceInput();
                else {
                  setVoiceError(undefined);
                  toggleVoiceInput();
                }
              }}
            >
              {voiceListening ? (
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden>
                  <rect x="6" y="6" width="12" height="12" rx="2" fill="currentColor" />
                </svg>
              ) : (
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden>
                  <path
                    d="M12 3a3 3 0 0 0-3 3v6a3 3 0 0 0 6 0V6a3 3 0 0 0-3-3Z"
                    stroke="currentColor"
                    strokeWidth="1.7"
                  />
                  <path
                    d="M5.5 11a6.5 6.5 0 0 0 13 0M12 17.5V21"
                    stroke="currentColor"
                    strokeWidth="1.7"
                    strokeLinecap="round"
                  />
                </svg>
              )}
            </button>
            <SpeechPlaybackControls
              speechState={speechState}
              onPause={pause}
              onResume={resume}
              onStop={stopSpeech}
              buttonClassName={styles.qaBtn}
            />
            <button
              type="button"
              className={styles.askBtn}
              disabled={asking || !hasKey || !place || !question.trim()}
              onClick={submitQuestion}
            >
              {asking ? 'Asking…' : 'Ask AI'}
            </button>
            <label className={styles.voiceToggle}>
              <input
                type="checkbox"
                checked={autoReadAnswers}
                onChange={(e) => {
                  const on = e.target.checked;
                  if (on) {
                    // Only read answers that arrive after enabling — skip existing last answer.
                    lastReadIdRef.current = thread[thread.length - 1]?.id;
                  }
                  setAutoReadAnswers(on);
                }}
              />
              Read new answers aloud
            </label>
            {!hasKey ? (
              <span className={styles.hint}>
                Add a Gemini API key in{' '}
                {onOpenSettings ? (
                  <button type="button" className={styles.settingsLink} onClick={onOpenSettings}>
                    User settings
                  </button>
                ) : (
                  'User settings'
                )}
                .
              </span>
            ) : null}
          </div>
          {voiceError ? <p className={styles.error}>{voiceError}</p> : null}
          {askError ? <p className={styles.error}>{askError}</p> : null}
        </div>
      ) : null}
    </section>
  );
};
