import * as React from 'react';
import type { ItineraryEntry } from '../../models/ItineraryEntry';
import { useConfig } from '../../context/ConfigContext';
import { usePlaces } from '../../context/PlacesContext';
import { useTripPermissions } from '../../hooks/useTripPermissions';
import { useTripWorkspace } from '../../context/TripWorkspaceContext';
import { answerTravelChat } from '../../services/GeminiService';
import { formatGeminiUserMessage } from '../../services/geminiErrorMessage';
import { buildAiCurrentFocusBlock, buildTripDayAiContext } from '../../utils/buildTripDayAiContext';
import { placeDisplayLabel } from '../../utils/placeDisplayLabel';
import { useSpeechOutput } from '../../hooks/useSpeechOutput';
import { useContinuousSpeechInput } from '../../hooks/useContinuousSpeechInput';
import { SpeechPlaybackControls } from '../shared/SpeechPlaybackControls';
import { markdownToHtml } from '../../utils/markdownToHtml';
import styles from './MobileDetailAiPanel.module.css';

export interface MobileDetailAiPanelProps {
  entry: ItineraryEntry;
  calendarDate?: string;
  /** When set, notes append to this option/sub-item instead of the parent entry. */
  optionContext?: { parentEntryId: string; subItemId: string };
  /** Extra one-line context, e.g. category-specific hint. */
  hint?: string;
}

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function appendNoteHtml(existing: string | undefined, addition: string): string {
  const html = markdownToHtml(addition.trim());
  const block = html.trim().startsWith('<') ? html : `<p>${escapeHtml(addition.trim())}</p>`;
  const prior = (existing || '').trim();
  return prior ? `${prior}${block}` : block;
}

export const MobileDetailAiPanel: React.FC<MobileDetailAiPanelProps> = ({
  entry,
  calendarDate,
  optionContext,
  hint
}) => {
  const { config } = useConfig();
  const { canUseAiHelpers, canEditItinerary } = useTripPermissions();
  const { trip, tripDays, localEntries, updateEntry, updateSubItem } = useTripWorkspace();
  const { placeById } = usePlaces();
  const [open, setOpen] = React.useState(false);
  const [prompt, setPrompt] = React.useState('');
  const [answer, setAnswer] = React.useState('');
  const [busy, setBusy] = React.useState(false);
  const [error, setError] = React.useState('');
  const { speechState, speak, pause, resume, stop: stopSpeech } = useSpeechOutput();
  const appendVoice = React.useCallback((chunk: string) => {
    setPrompt((prev) => `${prev}${prev ? ' ' : ''}${chunk}`);
  }, []);
  const { listening, supported, toggleListening, stopListening } = useContinuousSpeechInput(appendVoice);

  const resetQa = React.useCallback(() => {
    setPrompt('');
    setAnswer('');
    setError('');
    stopListening();
    stopSpeech();
  }, [stopListening, stopSpeech]);

  if (!canUseAiHelpers) return null;

  const entryContext = [
    `Itinerary item: ${entry.title || 'Untitled'}`,
    `Category: ${entry.category}`,
    entry.location ? `Location: ${entry.location}` : '',
    entry.notes ? `Existing notes: ${entry.notes.replace(/<[^>]+>/g, ' ').slice(0, 400)}` : '',
    hint || ''
  ]
    .filter(Boolean)
    .join('\n');

  const ask = async (): Promise<void> => {
    const text = prompt.trim();
    if (!text || busy) return;
    setBusy(true);
    setError('');
    stopListening();
    try {
      const day = tripDays.find((d) => d.id === entry.dayId);
      const place = day?.primaryPlaceId ? placeById(day.primaryPlaceId) : undefined;
      const placeTitle = place ? placeDisplayLabel(place) : entry.location || entry.title;
      const tripContext = trip
        ? buildTripDayAiContext({
            trip,
            tripDays,
            day,
            entries: localEntries,
            placeTitle,
            placeForDay: (d) => {
              const p = d.primaryPlaceId ? placeById(d.primaryPlaceId) : undefined;
              return p;
            },
            daySpecific: true
          })
        : undefined;
      const focus = buildAiCurrentFocusBlock({
        isTasksView: false,
        dayScope: 'day',
        selectedDay: day,
        placeTitle,
        mainWorkspaceTab: 'plan'
      });
      const { answer: raw } = await answerTravelChat(
        config.geminiApiKey,
        [{ role: 'user', text: `${entryContext}\n\nQuestion: ${text}` }],
        tripContext,
        { currentFocusBlock: focus }
      );
      setAnswer(raw);
      if (config.speechEngine || config.browserVoiceURI) speak(raw);
    } catch (err) {
      setError(formatGeminiUserMessage(err));
    } finally {
      setBusy(false);
    }
  };

  const addToNotes = (): void => {
    if (!canEditItinerary || !answer.trim()) return;
    const latestEntry = localEntries.find((e) => e.id === entry.id) ?? entry;
    const notes = appendNoteHtml(latestEntry.notes, answer);
    if (optionContext) {
      const parent = localEntries.find((e) => e.id === optionContext.parentEntryId);
      const sub = parent?.subItems?.find((s) => s.id === optionContext.subItemId);
      if (!parent || !sub) return;
      updateSubItem(parent.id, { ...sub, notes });
    } else {
      updateEntry({ ...latestEntry, notes });
    }
    resetQa();
  };

  return (
    <section className={styles.root}>
      <button type="button" className={styles.head} onClick={() => setOpen((v) => !v)} aria-expanded={open}>
        <span className={styles.spark} aria-hidden>
          ✦
        </span>
        <span className={styles.headLabel}>Ask AI about this</span>
        <span aria-hidden>{open ? '▾' : '▸'}</span>
      </button>
      {open ? (
        <div className={styles.body}>
          <div className={styles.inputRow}>
            <input
              className={styles.input}
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              placeholder="Ask anything about this item…"
              aria-label="Ask AI about this item"
              onKeyDown={(e) => {
                if (e.key === 'Enter') void ask();
              }}
            />
            <button
              type="button"
              className={`${styles.iconBtn} ${listening ? styles.iconBtnOn : ''}`}
              onClick={toggleListening}
              disabled={!supported}
              aria-label={listening ? 'Stop listening' : 'Speak your question'}
              title={
                !supported
                  ? 'Speech input is not supported in this browser'
                  : listening
                    ? 'Stop listening'
                    : 'Speak your question'
              }
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden>
                <rect x="9" y="3" width="6" height="11" rx="3" stroke="currentColor" strokeWidth="1.8" />
                <path d="M6 11a6 6 0 0 0 12 0M12 17v4" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
              </svg>
            </button>
            <button type="button" className={styles.goBtn} disabled={busy || !prompt.trim()} onClick={() => void ask()}>
              Ask
            </button>
          </div>
          {!supported ? (
            <p className={styles.micUnsupported}>Microphone input is not supported in this browser.</p>
          ) : null}
          {error ? <p className={styles.error}>{error}</p> : null}
          {busy ? <p className={styles.muted}>Thinking…</p> : null}
          {answer ? (
            <div className={styles.answerBox}>
              <p className={styles.answer}>{answer}</p>
              <div className={styles.answerActions}>
                <button type="button" className={styles.smallBtn} onClick={() => speak(answer)} aria-label="Read answer aloud">
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" aria-hidden>
                    <path d="M11 5 6 9H3v6h3l5 4V5Z" stroke="currentColor" strokeWidth="1.6" strokeLinejoin="round" />
                    <path d="M15.5 8.5a5 5 0 0 1 0 7" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
                  </svg>
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
                {canEditItinerary ? (
                  <button type="button" className={styles.smallBtnPrimary} onClick={addToNotes}>
                    Add to notes
                  </button>
                ) : null}
                <button type="button" className={styles.smallBtn} onClick={resetQa}>
                  Clear
                </button>
              </div>
            </div>
          ) : null}
        </div>
      ) : null}
    </section>
  );
};
