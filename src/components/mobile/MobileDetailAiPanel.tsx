import * as React from 'react';
import type { ItineraryEntry } from '../../models/ItineraryEntry';
import type { LocationInfoQaEntry } from '../../utils/locationInfoEntry';
import { useConfig } from '../../context/ConfigContext';
import { usePlaces } from '../../context/PlacesContext';
import { useTripPermissions } from '../../hooks/useTripPermissions';
import { useTripWorkspace } from '../../context/TripWorkspaceContext';
import { answerLocationQuestion } from '../../services/GeminiService';
import { formatGeminiUserMessage } from '../../services/geminiErrorMessage';
import { placeDisplayLabel, placeNameFromTitle } from '../../utils/placeDisplayLabel';
import { joinNotesAndQa, splitNotesAndQa, type EntryQaEntry } from '../../utils/entryQaThread';
import { sanitizeIdeaAiAnswer } from './MobileIdeaAskAi';
import { confirmUserAction } from '../../utils/confirmAction';
import { useSpeechOutput } from '../../hooks/useSpeechOutput';
import { useContinuousSpeechInput } from '../../hooks/useContinuousSpeechInput';
import { SpeechPlaybackControls } from '../shared/SpeechPlaybackControls';
import { LinkifiedText } from '../shared/LinkifiedText';
import { RichTextContent } from '../shared/RichTextContent';
import { isLikelyJournalHtml, richTextToPlainText } from '../../utils/journalRichText';
import { qaEntryTitle } from '../../utils/qaDisplayText';
import { ReminderService } from '../../services/ReminderService';
import { useSpContext } from '../../context/SpContext';
import styles from './MobileIdeaAskAi.module.css';

export interface MobileDetailAiPanelProps {
  entry: ItineraryEntry;
  calendarDate?: string;
  optionContext?: { parentEntryId: string; subItemId: string };
  hint?: string;
}

function newQaId(): string {
  return `entry-qa-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

/**
 * Ask AI for itinerary items — same options/icons as location-info Q&A
 * (thread, edit/delete, reply, listen, create task, add to itinerary, auto-read).
 */
export const MobileDetailAiPanel: React.FC<MobileDetailAiPanelProps> = ({
  entry,
  optionContext,
  hint
}) => {
  const { config } = useConfig();
  const { canUseAiHelpers, canEditItinerary } = useTripPermissions();
  const { trip, tripDays, localEntries, updateEntry, updateSubItem, stageDraftEntry, setSelectedDayId, setEditingCardId } =
    useTripWorkspace();
  const { placeById } = usePlaces();
  const spContext = useSpContext();

  const latestEntry = localEntries.find((e) => e.id === entry.id) ?? entry;
  const { notes: displayNotes, thread: savedThread } = splitNotesAndQa(latestEntry.notes);

  const [open, setOpen] = React.useState(Boolean(savedThread.length));
  const [localThread, setLocalThread] = React.useState<EntryQaEntry[]>(savedThread);
  const [question, setQuestion] = React.useState('');
  const [busy, setBusy] = React.useState(false);
  const [error, setError] = React.useState('');
  const [editingId, setEditingId] = React.useState<string | null>(null);
  const [editQuestionDraft, setEditQuestionDraft] = React.useState('');
  const [editAnswerDraft, setEditAnswerDraft] = React.useState('');
  const [autoReadAnswers, setAutoReadAnswers] = React.useState(false);
  const [replyParentId, setReplyParentId] = React.useState<string | null>(null);
  const [replyDraft, setReplyDraft] = React.useState('');
  const [repliesExpanded, setRepliesExpanded] = React.useState<Set<string>>(() => new Set());
  const lastReadIdRef = React.useRef<string | undefined>();
  const { speechState, speak, pause, resume, stop: stopSpeech } = useSpeechOutput();
  const appendVoice = React.useCallback((chunk: string) => {
    setQuestion((prev) => `${prev}${prev ? ' ' : ''}${chunk}`);
  }, []);
  const { listening, toggleListening, stopListening, supported } = useContinuousSpeechInput(appendVoice);

  React.useEffect(() => {
    setLocalThread(savedThread);
    if (savedThread.length) setOpen(true);
  }, [latestEntry.id, latestEntry.notes]);

  React.useEffect(() => {
    if (!autoReadAnswers) return;
    const last = localThread[localThread.length - 1];
    if (!last || last.id === lastReadIdRef.current) return;
    lastReadIdRef.current = last.id;
    const plain = richTextToPlainText(last.answer || '').trim() || (last.answer || '').trim();
    if (plain) {
      stopListening();
      speak(plain);
    }
  }, [autoReadAnswers, localThread, speak, stopListening]);

  if (!canUseAiHelpers) return null;

  const persistThread = async (next: EntryQaEntry[]): Promise<void> => {
    setLocalThread(next);
    const notes = joinNotesAndQa(displayNotes, next);
    if (optionContext) {
      const parent = localEntries.find((e) => e.id === optionContext.parentEntryId);
      const sub = parent?.subItems?.find((s) => s.id === optionContext.subItemId);
      if (!parent || !sub) return;
      updateSubItem(parent.id, { ...sub, notes });
      return;
    }
    await updateEntry({ ...latestEntry, notes });
  };

  const day = tripDays.find((d) => d.id === entry.dayId);
  const place = day?.primaryPlaceId ? placeById(day.primaryPlaceId) : undefined;
  const placeLabel = place ? placeDisplayLabel(place) : entry.location || entry.title || 'this place';
  const placeName = placeNameFromTitle(placeLabel) || placeLabel;
  const country =
    placeLabel.includes(',')
      ? placeLabel
          .split(',')
          .map((p) => p.trim())
          .filter(Boolean)
          .slice(-1)[0] || 'unknown'
      : place?.country || 'unknown';

  const speakAnswer = (answer: string): void => {
    stopListening();
    const plain = richTextToPlainText(answer || '').trim() || (answer || '').trim();
    if (plain) speak(plain);
  };

  const ask = async (raw?: string, parentId?: string): Promise<void> => {
    const q = (raw ?? (parentId ? replyDraft : question)).trim();
    if (!q || busy) return;
    const key = (config.geminiApiKey || '').trim();
    if (!key) {
      setError('Add a Gemini API key in settings to ask about this item.');
      return;
    }
    setBusy(true);
    setError('');
    stopListening();
    setOpen(true);
    try {
      const parent = parentId ? localThread.find((t) => t.id === parentId) : undefined;
      const priorBits = parent
        ? [
            `Original question: ${parent.question}`,
            `Original answer: ${parent.answer}`,
            ...(parent.replies || []).flatMap((r) => [`Earlier follow-up Q: ${r.question}`, `Earlier follow-up A: ${r.answer}`]),
            'Answer the follow-up in the context of this thread.'
          ].join('\n')
        : localThread.length
          ? `Earlier item Q&A:\n${localThread.map((x) => `Q: ${x.question}\nA: ${x.answer}`).join('\n')}`
          : '';
      const contextSummary = [
        `Itinerary item: ${entry.title || 'Untitled'}`,
        `Category: ${entry.category}`,
        entry.location ? `Location: ${entry.location}` : '',
        displayNotes ? `Notes: ${richTextToPlainText(displayNotes).slice(0, 500)}` : '',
        hint || '',
        priorBits
      ]
        .filter(Boolean)
        .join('\n');
      const { answer } = await answerLocationQuestion(placeName, country, q, {
        apiKey: key,
        contextSummary
      });
      const qa: EntryQaEntry = {
        id: newQaId(),
        question: q,
        answer: sanitizeIdeaAiAnswer(answer || ''),
        createdAt: new Date().toISOString()
      };
      let next: EntryQaEntry[];
      if (parentId) {
        next = localThread.map((t) =>
          t.id === parentId ? { ...t, replies: [...(t.replies ?? []), qa] } : t
        );
        setReplyParentId(null);
        setReplyDraft('');
        setRepliesExpanded((prev) => new Set(prev).add(parentId));
      } else {
        next = [...localThread, qa];
        setQuestion('');
      }
      await persistThread(next);
    } catch (err) {
      setError(formatGeminiUserMessage(err));
    } finally {
      setBusy(false);
    }
  };

  const createTaskFromQa = (item: LocationInfoQaEntry): void => {
    if (!trip?.id || !canEditItinerary) return;
    const svc = new ReminderService(spContext);
    void svc
      .create({
        title: qaEntryTitle(item),
        tripId: trip.id,
        dayId: entry.dayId,
        entryId: entry.id,
        reminderType: 'Manual',
        reminderText: qaEntryTitle(item),
        taskNote: richTextToPlainText(item.answer),
        dueDate: '',
        isComplete: false,
        taskCategory: 'To Do'
      })
      .then(() => window.dispatchEvent(new Event('trip-reminders-updated')))
      .catch(console.error);
  };

  const addQaToItinerary = (item: LocationInfoQaEntry): void => {
    if (!trip?.id || !canEditItinerary) return;
    const dayId = entry.dayId || tripDays[0]?.id;
    if (!dayId) return;
    const draftId = `new-${Date.now()}`;
    const draft: ItineraryEntry = {
      ...entry,
      id: draftId,
      dayId,
      tripId: trip.id,
      title: qaEntryTitle(item),
      category: entry.category || 'Activities',
      notes: item.answer || '',
      timeStart: '',
      duration: '',
      supplier: '',
      decisionStatus: 'Idea',
      bookingRequired: false,
      bookingStatus: 'Not booked',
      paymentStatus: 'Not paid',
      amount: 0,
      currency: entry.currency || 'NZD',
      sortOrder: 999,
      parentEntryId: undefined,
      subItems: []
    };
    stageDraftEntry(draft);
    setSelectedDayId(dayId);
    setEditingCardId(draftId);
  };

  const renderActions = (item: EntryQaEntry): React.ReactNode => (
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
              void persistThread(
                localThread.map((t) => (t.id === item.id ? { ...t, question: nextQ, answer: nextA } : t))
              );
              setEditingId(null);
            }}
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden>
              <path d="M5 12.5 9.5 17 19 7.5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
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
            <button type="button" className={styles.iconBtn} onClick={() => speakAnswer(item.answer)} aria-label="Listen" title="Listen">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden>
                <path d="M3 10v4h4l5 4V6L7 10H3Z" fill="currentColor" />
                <path d="M16 9a4 4 0 0 1 0 6M18.5 7a7 7 0 0 1 0 10" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
              </svg>
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
              <path d="M4 20h4l10.5-10.5a2.1 2.1 0 0 0-3-3L5 17v3Z" stroke="currentColor" strokeWidth="1.7" strokeLinejoin="round" />
              <path d="M12.5 7.5l3 3" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" />
            </svg>
          </button>
          {canEditItinerary ? (
            <button type="button" className={styles.iconBtn} aria-label="Create task" title="Create task" onClick={() => createTaskFromQa(item)}>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden>
                <path d="M9 11.5 11 13.5 15.5 9" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" />
                <rect x="4" y="4" width="16" height="16" rx="2" stroke="currentColor" strokeWidth="1.6" />
              </svg>
            </button>
          ) : null}
          {canEditItinerary ? (
            <button
              type="button"
              className={styles.iconBtn}
              aria-label="Add to itinerary"
              title="Add to itinerary"
              onClick={() => addQaToItinerary(item)}
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden>
                <path d="M12 5v14M5 12h14" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
              </svg>
            </button>
          ) : null}
          <button
            type="button"
            className={styles.iconBtn}
            aria-label="Reply"
            title="Ask a follow-up"
            disabled={busy}
            onClick={() => {
              setReplyParentId((prev) => (prev === item.id ? null : item.id));
              setReplyDraft('');
            }}
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden>
              <path d="M4 12h12M12 6l6 6-6 6" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </button>
          <button
            type="button"
            className={`${styles.iconBtn} ${styles.iconBtnDanger}`}
            aria-label="Delete"
            title="Delete"
            onClick={() => {
              void (async () => {
                if (!(await confirmUserAction('Delete this Q&A entry?'))) return;
                await persistThread(localThread.filter((t) => t.id !== item.id));
              })();
            }}
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
  );

  return (
    <div className={styles.root}>
      <button type="button" className={styles.toggle} onClick={() => setOpen((v) => !v)} aria-expanded={open}>
        <span aria-hidden>✦</span> Ask AI about this {open ? '▾' : '▸'}
        {localThread.length ? <span className={styles.count}>{localThread.length}</span> : null}
      </button>
      {open ? (
        <div className={styles.panel}>
          <div className={styles.inputRow}>
            <input
              className={styles.input}
              value={question}
              onChange={(e) => setQuestion(e.target.value)}
              placeholder="Ask anything about this item…"
              aria-label="Ask about this item"
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
                      <textarea className={styles.editArea} rows={2} value={editQuestionDraft} onChange={(e) => setEditQuestionDraft(e.target.value)} />
                      <textarea className={styles.editArea} rows={4} value={editAnswerDraft} onChange={(e) => setEditAnswerDraft(e.target.value)} />
                    </div>
                  ) : (
                    <>
                      <p className={styles.q}>
                        <strong>Q:</strong> {item.question}
                      </p>
                      <div className={styles.a}>
                        <strong>A:</strong>{' '}
                        {isLikelyJournalHtml(item.answer) ? <RichTextContent html={item.answer} /> : <LinkifiedText text={item.answer} />}
                      </div>
                    </>
                  )}
                  {renderActions(item)}
                  {(item.replies?.length || replyParentId === item.id) ? (
                    <div className={styles.replyThread}>
                      {(item.replies?.length ?? 0) > 0 ? (
                        <button
                          type="button"
                          className={styles.replyToggle}
                          aria-expanded={repliesExpanded.has(item.id)}
                          onClick={() =>
                            setRepliesExpanded((prev) => {
                              const next = new Set(prev);
                              if (next.has(item.id)) next.delete(item.id);
                              else next.add(item.id);
                              return next;
                            })
                          }
                        >
                          {repliesExpanded.has(item.id) ? '▾' : '▸'} {item.replies!.length} follow-up
                          {item.replies!.length === 1 ? '' : 's'}
                        </button>
                      ) : null}
                      {repliesExpanded.has(item.id)
                        ? (item.replies ?? []).map((reply) => (
                            <div key={reply.id} className={styles.replyItem}>
                              <p className={styles.replyQ}>Q: {qaEntryTitle(reply)}</p>
                              <div className={styles.replyA}>
                                {isLikelyJournalHtml(reply.answer) ? (
                                  <RichTextContent html={reply.answer} />
                                ) : (
                                  <LinkifiedText text={reply.answer} />
                                )}
                              </div>
                            </div>
                          ))
                        : null}
                      {replyParentId === item.id ? (
                        <div className={styles.replyComposer}>
                          <input
                            className={styles.input}
                            value={replyDraft}
                            onChange={(e) => setReplyDraft(e.target.value)}
                            placeholder="Ask a follow-up…"
                            aria-label="Follow-up question"
                          />
                          <button type="button" className={styles.askBtn} disabled={busy || !replyDraft.trim()} onClick={() => void ask(undefined, item.id)}>
                            Reply
                          </button>
                        </div>
                      ) : null}
                    </div>
                  ) : null}
                </li>
              ))}
            </ul>
          ) : null}
        </div>
      ) : null}
    </div>
  );
};
