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
  onOpenSettings?: () => void;
  onThreadChange?: (thread: LocationInfoQaEntry[]) => void;
}

export const LocationInfoAskPanel: React.FC<LocationInfoAskPanelProps> = ({
  entry,
  place,
  data,
  geminiApiKey,
  readOnly = false,
  onOpenSettings,
  onThreadChange
}) => {
  const spContext = useSpContext();
  const [question, setQuestion] = React.useState('');
  const [asking, setAsking] = React.useState(false);
  const [askError, setAskError] = React.useState<string | undefined>();
  const [editingId, setEditingId] = React.useState<string | null>(null);
  const [editDraft, setEditDraft] = React.useState('');
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
    <section className={styles.root} aria-label="Ask about this place">
      <h4 className={styles.intro}>
        Ask AI about this place (separate from highlights and overview). Answers are saved here and never overwrite your
        lists.
      </h4>
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
                      <textarea
                        className={styles.editArea}
                        rows={5}
                        value={editDraft}
                        onChange={(e) => setEditDraft(e.target.value)}
                      />
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
                        <button type="button" className={styles.qaBtn} onClick={() => speakAnswer(item.answer)}>
                          Read out
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
                                const answer = editDraft.trim();
                                if (!answer) return;
                                updateThread(thread.map((t) => (t.id === item.id ? { ...t, answer } : t)));
                                setEditingId(null);
                              }}
                            >
                              Save
                            </button>
                            <button type="button" className={styles.qaBtn} onClick={() => setEditingId(null)}>
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
                                setEditDraft(richTextToPlainText(item.answer));
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
              className={styles.qaBtn}
              disabled={asking || !hasKey || !place}
              onClick={() => {
                if (voiceListening) stopVoiceInput();
                else {
                  setVoiceError(undefined);
                  toggleVoiceInput();
                }
              }}
            >
              {voiceListening ? 'Stop listening' : 'Voice input'}
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
              <input type="checkbox" checked={autoReadAnswers} onChange={(e) => setAutoReadAnswers(e.target.checked)} />
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
