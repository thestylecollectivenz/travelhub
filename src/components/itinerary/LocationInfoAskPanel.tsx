import * as React from 'react';
import type { ItineraryEntry } from '../../models/ItineraryEntry';
import type { Place } from '../../models/Place';
import type { LocationInfoNotes, LocationInfoQaEntry } from '../../utils/locationInfoEntry';
import { useSpContext } from '../../context/SpContext';
import { subscribeLocationInfoAIStatus } from '../../utils/locationInfoAIEvents';
import { scheduleLocationInfoQuestion } from '../../utils/locationInfoGeneration';
import { LinkifiedText } from '../shared/LinkifiedText';
import { RichTextField } from '../shared/RichTextField';
import { RichTextContent } from '../shared/RichTextContent';
import { isLikelyJournalHtml, richTextToPlainText } from '../../utils/journalRichText';
import { confirmUserAction } from '../../utils/confirmAction';
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
  const [voiceListening, setVoiceListening] = React.useState(false);
  const [voiceError, setVoiceError] = React.useState<string | undefined>();
  const [autoReadAnswers, setAutoReadAnswers] = React.useState(false);

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
      }
    });
  }, [entry.id]);

  React.useEffect(() => {
    if (!autoReadAnswers) return;
    const last = thread[thread.length - 1];
    if (!last?.answer?.trim()) return;
    if (typeof window === 'undefined' || !window.speechSynthesis) return;
    const utter = new SpeechSynthesisUtterance(richTextToPlainText(last.answer));
    window.speechSynthesis.cancel();
    window.speechSynthesis.speak(utter);
  }, [autoReadAnswers, thread]);

  const updateThread = (next: LocationInfoQaEntry[]): void => {
    onThreadChange?.(next);
  };

  const submitQuestion = (): void => {
    if (!place || !hasKey || readOnly) return;
    const q = richTextToPlainText(question);
    if (!q) return;
    setAskError(undefined);
    scheduleLocationInfoQuestion({
      spContext,
      entry,
      place,
      apiKey: geminiApiKey,
      question: q
    });
  };

  const startVoiceInput = (): void => {
    if (typeof window === 'undefined') return;
    const Ctor = (window as Window & { SpeechRecognition?: any; webkitSpeechRecognition?: any }).SpeechRecognition
      || (window as Window & { SpeechRecognition?: any; webkitSpeechRecognition?: any }).webkitSpeechRecognition;
    if (!Ctor) {
      setVoiceError('Voice input is not supported in this browser.');
      return;
    }
    const recognition = new Ctor();
    recognition.lang = 'en-NZ';
    recognition.interimResults = false;
    recognition.maxAlternatives = 1;
    setVoiceError(undefined);
    setVoiceListening(true);
    recognition.onresult = (event: SpeechRecognitionEvent): void => {
      const transcript = event.results?.[0]?.[0]?.transcript?.trim() || '';
      if (transcript) {
        setQuestion((prev) => `${prev}${prev ? '\n' : ''}${transcript}`);
      }
    };
    recognition.onerror = (): void => {
      setVoiceError('Could not capture voice input. Please try again.');
    };
    recognition.onend = (): void => setVoiceListening(false);
    recognition.start();
  };

  const speakAnswer = (answer: string): void => {
    if (typeof window === 'undefined' || !window.speechSynthesis) return;
    const text = richTextToPlainText(answer);
    if (!text) return;
    const utter = new SpeechSynthesisUtterance(text);
    window.speechSynthesis.cancel();
    window.speechSynthesis.speak(utter);
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
          {thread.map((item) => (
            <div key={item.id} className={styles.qaBlock}>
              <div className={styles.question}>Q: {item.question}</div>
              {editingId === item.id ? (
                <RichTextField value={editDraft} onChange={setEditDraft} minHeight="5rem" />
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
                  {editingId === item.id ? (
                    <>
                      <button
                        type="button"
                        className={styles.qaBtn}
                        onClick={() => {
                          const answer = editDraft.trim();
                          if (!richTextToPlainText(answer)) return;
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
                          setEditDraft(item.answer);
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
          ))}
        </div>
      ) : null}
      {!readOnly ? (
        <div className={styles.askRow}>
          <div className={styles.askRich}>
            <RichTextField value={question} onChange={setQuestion} minHeight="4.5rem" />
          </div>
          <div className={styles.askActions}>
            <button
              type="button"
              className={styles.qaBtn}
              disabled={asking || !hasKey || !place}
              onClick={startVoiceInput}
            >
              {voiceListening ? 'Listening…' : 'Voice input'}
            </button>
            <button
              type="button"
              className={styles.askBtn}
              disabled={asking || !hasKey || !place || !richTextToPlainText(question)}
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
