import * as React from 'react';
import { useConfig } from '../../context/ConfigContext';
import { usePlaces } from '../../context/PlacesContext';
import { usePlanView } from '../../context/PlanViewContext';
import { useSpContext } from '../../context/SpContext';
import { useTripWorkspace } from '../../context/TripWorkspaceContext';
import { answerTravelChat } from '../../services/GeminiService';
import { formatGeminiUserMessage } from '../../services/geminiErrorMessage';
import { ReminderService, type TripReminder } from '../../services/ReminderService';
import { LinkifiedText } from '../shared/LinkifiedText';
import { RichTextContent } from '../shared/RichTextContent';
import { loadAiChatMessages, pruneAiChatHistory, saveAiChatMessages } from '../../utils/aiChatHistory';
import { buildAiCurrentFocusBlock, buildTripDayAiContext } from '../../utils/buildTripDayAiContext';
import { buildTripTasksAiContext } from '../../utils/buildTripTasksAiContext';
import { markdownToHtml } from '../../utils/markdownToHtml';
import { placeDisplayLabel } from '../../utils/placeDisplayLabel';
import styles from './AiAssistantFab.module.css';

const FAB_SIZE = 48;
const DRAG_THRESHOLD_PX = 6;
const STORAGE_KEY = 'travelhub-ai-fab-pos';
const PANEL_SIZE_STORAGE_KEY = 'travelhub-ai-panel-size';
const DEFAULT_PANEL_WIDTH = 352;
const DEFAULT_PANEL_HEIGHT = 448;
const MIN_PANEL_WIDTH = 280;
const MIN_PANEL_HEIGHT = 260;

interface FabPosition {
  x: number;
  y: number;
}

interface PanelSize {
  width: number;
  height: number;
}

function defaultFabPosition(): FabPosition {
  if (typeof window === 'undefined') {
    return { x: 0, y: 0 };
  }
  return {
    x: Math.max(8, window.innerWidth - FAB_SIZE - 20),
    y: Math.max(8, window.innerHeight - FAB_SIZE - 20)
  };
}

function clampFabPosition(pos: FabPosition): FabPosition {
  if (typeof window === 'undefined') {
    return pos;
  }
  const maxX = Math.max(8, window.innerWidth - FAB_SIZE - 8);
  const maxY = Math.max(8, window.innerHeight - FAB_SIZE - 8);
  return {
    x: Math.min(Math.max(8, pos.x), maxX),
    y: Math.min(Math.max(8, pos.y), maxY)
  };
}

function loadFabPosition(): FabPosition {
  if (typeof window === 'undefined') {
    return defaultFabPosition();
  }
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return defaultFabPosition();
    const parsed = JSON.parse(raw) as Partial<FabPosition>;
    if (typeof parsed.x === 'number' && typeof parsed.y === 'number') {
      return clampFabPosition({ x: parsed.x, y: parsed.y });
    }
  } catch {
    // ignore corrupt storage
  }
  return defaultFabPosition();
}

function clampPanelSize(size: PanelSize): PanelSize {
  if (typeof window === 'undefined') {
    return size;
  }
  const maxWidth = Math.max(MIN_PANEL_WIDTH, window.innerWidth - 16);
  const maxHeight = Math.max(MIN_PANEL_HEIGHT, Math.floor(window.innerHeight * 0.85));
  return {
    width: Math.min(Math.max(MIN_PANEL_WIDTH, size.width), maxWidth),
    height: Math.min(Math.max(MIN_PANEL_HEIGHT, size.height), maxHeight)
  };
}

function defaultPanelSize(): PanelSize {
  if (typeof window === 'undefined') {
    return { width: DEFAULT_PANEL_WIDTH, height: DEFAULT_PANEL_HEIGHT };
  }
  return clampPanelSize({
    width: Math.min(DEFAULT_PANEL_WIDTH, window.innerWidth - 16),
    height: Math.min(DEFAULT_PANEL_HEIGHT, Math.floor(window.innerHeight * 0.7))
  });
}

function loadPanelSize(): PanelSize {
  if (typeof window === 'undefined') {
    return defaultPanelSize();
  }
  try {
    const raw = window.localStorage.getItem(PANEL_SIZE_STORAGE_KEY);
    if (!raw) return defaultPanelSize();
    const parsed = JSON.parse(raw) as Partial<PanelSize>;
    if (typeof parsed.width === 'number' && typeof parsed.height === 'number') {
      return clampPanelSize({ width: parsed.width, height: parsed.height });
    }
  } catch {
    // ignore corrupt storage
  }
  return defaultPanelSize();
}

function panelPosition(fab: FabPosition, panelWidth: number, panelHeight: number): FabPosition {
  if (typeof window === 'undefined') {
    return { x: fab.x, y: fab.y - panelHeight - 12 };
  }
  let left = fab.x;
  let top = fab.y - panelHeight - 12;
  if (top < 8) {
    top = fab.y + FAB_SIZE + 12;
  }
  left = Math.min(Math.max(8, left), Math.max(8, window.innerWidth - panelWidth - 8));
  top = Math.min(Math.max(8, top), Math.max(8, window.innerHeight - panelHeight - 8));
  return { x: left, y: top };
}

export const AiAssistantFab: React.FC = () => {
  const { config } = useConfig();
  const spContext = useSpContext();
  const planView = usePlanView();
  const { trip, tripDays, selectedDayId, localEntries, mainWorkspaceTab } = useTripWorkspace();
  const { placeById } = usePlaces();
  const [reminders, setReminders] = React.useState<TripReminder[]>([]);
  const [open, setOpen] = React.useState(false);
  const [input, setInput] = React.useState('');
  const [busy, setBusy] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [messages, setMessages] = React.useState<Array<{ role: 'user' | 'assistant'; text: string }>>([]);
  const [copyState, setCopyState] = React.useState<'idle' | 'copied' | 'error'>('idle');
  const [dayScope, setDayScope] = React.useState<'day' | 'general'>('day');
  const [voiceListening, setVoiceListening] = React.useState(false);
  const [autoReadAnswers, setAutoReadAnswers] = React.useState(false);
  const [fabPos, setFabPos] = React.useState<FabPosition>(() => loadFabPosition());
  const [panelSize, setPanelSize] = React.useState<PanelSize>(() => loadPanelSize());
  const dragRef = React.useRef<{
    pointerId: number;
    startX: number;
    startY: number;
    originX: number;
    originY: number;
    moved: boolean;
  } | null>(null);
  const resizeRef = React.useRef<{
    pointerId: number;
    startX: number;
    startY: number;
    originWidth: number;
    originHeight: number;
  } | null>(null);

  React.useEffect(() => {
    const onResize = (): void => {
      setFabPos((prev) => clampFabPosition(prev));
      setPanelSize((prev) => clampPanelSize(prev));
    };
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, []);

  React.useEffect(() => {
    if (!trip?.id) {
      setMessages([]);
      return;
    }
    pruneAiChatHistory();
    setMessages(loadAiChatMessages(trip.id));
  }, [trip?.id]);

  React.useEffect(() => {
    if (!trip?.id) {
      setReminders([]);
      return;
    }
    const svc = new ReminderService(spContext);
    const load = (): void => {
      svc
        .getForTrip(trip.id)
        .then(setReminders)
        .catch(() => setReminders([]));
    };
    load();
    window.addEventListener('trip-reminders-updated', load);
    return () => window.removeEventListener('trip-reminders-updated', load);
  }, [spContext, trip?.id]);

  const isTasksView = mainWorkspaceTab === 'plan' && planView?.planTab === 'tasks';

  const selectedDay = React.useMemo(
    () => (selectedDayId ? tripDays.find((d) => d.id === selectedDayId) : undefined),
    [selectedDayId, tripDays]
  );

  const buildSendContext = React.useCallback(() => {
    if (!trip) return { tripContext: '', currentFocusBlock: '' };
    const day =
      selectedDayId ? tripDays.find((d) => d.id === selectedDayId && d.tripId === trip.id) : undefined;
    const place = day?.primaryPlaceId ? placeById(day.primaryPlaceId) : undefined;
    const placeTitle = place ? placeDisplayLabel(place) : undefined;

    const currentFocusBlock = buildAiCurrentFocusBlock({
      isTasksView,
      dayScope,
      selectedDay: day,
      placeTitle,
      mainWorkspaceTab
    });

    if (isTasksView) {
      return {
        tripContext: buildTripTasksAiContext({
          trip,
          tripDays,
          entries: localEntries,
          reminders
        }),
        currentFocusBlock
      };
    }

    return {
      tripContext: buildTripDayAiContext({
        trip,
        tripDays,
        day,
        entries: localEntries,
        placeTitle,
        placeForDay: (d) => {
          const p = d.primaryPlaceId ? placeById(d.primaryPlaceId) : undefined;
          return p;
        },
        daySpecific: dayScope === 'day'
      }),
      currentFocusBlock
    };
  }, [
    trip,
    tripDays,
    selectedDayId,
    localEntries,
    placeById,
    dayScope,
    isTasksView,
    reminders,
    mainWorkspaceTab
  ]);

  const persistMessages = React.useCallback(
    (next: Array<{ role: 'user' | 'assistant'; text: string }>) => {
      if (!trip?.id) return;
      saveAiChatMessages(trip.id, next);
    },
    [trip?.id]
  );

  const send = async (): Promise<void> => {
    const text = input.trim();
    if (!text || busy) return;
    if (!config.geminiApiKey?.trim()) {
      setError('Add a Gemini API key in User settings.');
      return;
    }
    const nextMessages = [...messages, { role: 'user' as const, text }];
    setMessages(nextMessages);
    persistMessages(nextMessages);
    setInput('');
    setError(null);
    setBusy(true);
    try {
      const { tripContext: freshContext, currentFocusBlock } = buildSendContext();
      const { answer } = await answerTravelChat(config.geminiApiKey, nextMessages, freshContext, {
        currentFocusBlock
      });
      const withAnswer = [...nextMessages, { role: 'assistant' as const, text: answer }];
      setMessages(withAnswer);
      persistMessages(withAnswer);
    } catch (err) {
      setError(formatGeminiUserMessage(err));
      setMessages((prev) => prev.slice(0, -1));
      persistMessages(messages);
      setInput(text);
    } finally {
      setBusy(false);
    }
  };

  const speakText = React.useCallback((text: string): void => {
    if (typeof window === 'undefined' || !window.speechSynthesis) return;
    const t = (text || '').trim();
    if (!t) return;
    const u = new SpeechSynthesisUtterance(t);
    window.speechSynthesis.cancel();
    window.speechSynthesis.speak(u);
  }, []);

  const startVoiceInput = (): void => {
    if (typeof window === 'undefined') return;
    const Ctor = (window as Window & { SpeechRecognition?: any; webkitSpeechRecognition?: any }).SpeechRecognition
      || (window as Window & { SpeechRecognition?: any; webkitSpeechRecognition?: any }).webkitSpeechRecognition;
    if (!Ctor) {
      setError('Voice input is not supported in this browser.');
      return;
    }
    const recognition = new Ctor();
    recognition.lang = 'en-NZ';
    recognition.interimResults = false;
    recognition.maxAlternatives = 1;
    setVoiceListening(true);
    recognition.onresult = (event: { results?: Array<{ 0?: { transcript?: string } }> }): void => {
      const transcript = event.results?.[0]?.[0]?.transcript?.trim() || '';
      if (transcript) setInput((prev) => `${prev}${prev ? '\n' : ''}${transcript}`);
    };
    recognition.onerror = (): void => setError('Could not capture voice input.');
    recognition.onend = (): void => setVoiceListening(false);
    recognition.start();
  };

  const onFabPointerDown = (e: React.PointerEvent<HTMLButtonElement>): void => {
    if (e.button !== 0) return;
    dragRef.current = {
      pointerId: e.pointerId,
      startX: e.clientX,
      startY: e.clientY,
      originX: fabPos.x,
      originY: fabPos.y,
      moved: false
    };
    e.currentTarget.setPointerCapture(e.pointerId);
  };

  const onFabPointerMove = (e: React.PointerEvent<HTMLButtonElement>): void => {
    const drag = dragRef.current;
    if (!drag || drag.pointerId !== e.pointerId) return;
    const dx = e.clientX - drag.startX;
    const dy = e.clientY - drag.startY;
    if (!drag.moved && Math.hypot(dx, dy) < DRAG_THRESHOLD_PX) return;
    drag.moved = true;
    setFabPos(clampFabPosition({ x: drag.originX + dx, y: drag.originY + dy }));
  };

  const onFabPointerUp = (e: React.PointerEvent<HTMLButtonElement>): void => {
    const drag = dragRef.current;
    if (!drag || drag.pointerId !== e.pointerId) return;
    const moved = drag.moved;
    const finalPos = clampFabPosition({
      x: drag.originX + (e.clientX - drag.startX),
      y: drag.originY + (e.clientY - drag.startY)
    });
    dragRef.current = null;
    if (e.currentTarget.hasPointerCapture(e.pointerId)) {
      e.currentTarget.releasePointerCapture(e.pointerId);
    }
    if (moved) {
      setFabPos(finalPos);
      try {
        window.localStorage.setItem(STORAGE_KEY, JSON.stringify(finalPos));
      } catch {
        // ignore storage failures
      }
      return;
    }
    setOpen((v) => !v);
  };

  const onResizePointerDown = (e: React.PointerEvent<HTMLDivElement>): void => {
    if (e.button !== 0) return;
    e.preventDefault();
    e.stopPropagation();
    resizeRef.current = {
      pointerId: e.pointerId,
      startX: e.clientX,
      startY: e.clientY,
      originWidth: panelSize.width,
      originHeight: panelSize.height
    };
    e.currentTarget.setPointerCapture(e.pointerId);
  };

  const onResizePointerMove = (e: React.PointerEvent<HTMLDivElement>): void => {
    const resize = resizeRef.current;
    if (!resize || resize.pointerId !== e.pointerId) return;
    const next = clampPanelSize({
      width: resize.originWidth + (e.clientX - resize.startX),
      height: resize.originHeight + (e.clientY - resize.startY)
    });
    setPanelSize(next);
  };

  const onResizePointerUp = (e: React.PointerEvent<HTMLDivElement>): void => {
    const resize = resizeRef.current;
    if (!resize || resize.pointerId !== e.pointerId) return;
    const finalSize = clampPanelSize({
      width: resize.originWidth + (e.clientX - resize.startX),
      height: resize.originHeight + (e.clientY - resize.startY)
    });
    resizeRef.current = null;
    if (e.currentTarget.hasPointerCapture(e.pointerId)) {
      e.currentTarget.releasePointerCapture(e.pointerId);
    }
    setPanelSize(finalSize);
    try {
      window.localStorage.setItem(PANEL_SIZE_STORAGE_KEY, JSON.stringify(finalSize));
    } catch {
      // ignore storage failures
    }
  };

  const panelWidth = panelSize.width;
  const panelHeight = panelSize.height;
  const panelPos = panelPosition(fabPos, panelWidth, panelHeight);

  const place = selectedDay?.primaryPlaceId ? placeById(selectedDay.primaryPlaceId) : undefined;
  const placeLabel = place ? placeDisplayLabel(place) : undefined;

  const contextHintParts: string[] = [];
  if (placeLabel) contextHintParts.push(placeLabel);
  if (selectedDay) {
    contextHintParts.push(`Day ${selectedDay.dayNumber}`);
    if (selectedDay.calendarDate) contextHintParts.push(selectedDay.calendarDate);
  }
  const contextHint = isTasksView
    ? 'To-do list — ask what is overdue, due today, or due tomorrow'
    : contextHintParts.length
      ? contextHintParts.join(' · ')
      : 'Select a day in the sidebar for date-specific tips';

  const latestAssistantIndex = React.useMemo(() => {
    for (let i = messages.length - 1; i >= 0; i -= 1) {
      if (messages[i].role === 'assistant') return i;
    }
    return -1;
  }, [messages]);

  React.useEffect(() => {
    if (!autoReadAnswers) return;
    const latest = latestAssistantIndex >= 0 ? messages[latestAssistantIndex] : undefined;
    if (!latest?.text?.trim()) return;
    speakText(latest.text);
  }, [autoReadAnswers, latestAssistantIndex, messages, speakText]);

  const copyLatestResponse = React.useCallback(() => {
    const latest = latestAssistantIndex >= 0 ? messages[latestAssistantIndex] : undefined;
    if (!latest?.text.trim()) return;
    const plain = latest.text.trim();
    const html = markdownToHtml(plain);
    const writeRich = async (): Promise<void> => {
      if (typeof ClipboardItem !== 'undefined' && navigator.clipboard.write) {
        await navigator.clipboard.write([
          new ClipboardItem({
            'text/html': new Blob([html], { type: 'text/html' }),
            'text/plain': new Blob([plain], { type: 'text/plain' })
          })
        ]);
        return;
      }
      await navigator.clipboard.writeText(plain);
    };
    void writeRich()
      .then(() => {
        setCopyState('copied');
        window.setTimeout(() => setCopyState('idle'), 2000);
      })
      .catch(() => {
        setCopyState('error');
        window.setTimeout(() => setCopyState('idle'), 2000);
      });
  }, [latestAssistantIndex, messages]);

  return (
    <>
      <button
        type="button"
        className={styles.fab}
        style={{ left: fabPos.x, top: fabPos.y }}
        aria-label="Chat with AI (drag to move)"
        title="Chat with AI — drag to reposition"
        onPointerDown={onFabPointerDown}
        onPointerMove={onFabPointerMove}
        onPointerUp={onFabPointerUp}
        onPointerCancel={onFabPointerUp}
      >
        ✦
      </button>
      {open ? (
        <div
          className={styles.panel}
          style={{ left: panelPos.x, top: panelPos.y, width: panelWidth, height: panelHeight }}
          role="dialog"
          aria-label="Travel AI chat"
        >
          <div className={styles.head}>
            <strong>Travel AI</strong>
            <button type="button" className={styles.closeBtn} onClick={() => setOpen(false)} aria-label="Close">
              ×
            </button>
          </div>
          <p className={styles.contextHint}>{contextHint}</p>
          <div className={styles.scopeRow}>
            <span className={styles.scopeLabel}>Context:</span>
            {isTasksView ? (
              <span className={styles.scopeBtnActive}>To-do list</span>
            ) : (
              <>
                <button
                  type="button"
                  className={`${styles.scopeBtn} ${dayScope === 'day' ? styles.scopeBtnActive : ''}`}
                  onClick={() => setDayScope('day')}
                >
                  This day
                </button>
                <button
                  type="button"
                  className={`${styles.scopeBtn} ${dayScope === 'general' ? styles.scopeBtnActive : ''}`}
                  onClick={() => setDayScope('general')}
                >
                  Whole trip
                </button>
              </>
            )}
          </div>
          <div className={styles.thread}>
            {!messages.length ? (
              <p className={styles.hint}>
                {isTasksView
                  ? 'Ask what you need to do today, tomorrow, or what is overdue — bookings, payments, and manual tasks.'
                  : 'Ask about this trip — routes, stations, timing, local tips. Answers use the selected day and what is already on your itinerary.'}
              </p>
            ) : null}
            {messages.map((m, i) => (
              <div key={i} className={m.role === 'user' ? styles.userMsg : styles.aiMsg}>
                {m.role === 'assistant' ? (
                  <RichTextContent html={markdownToHtml(m.text)} className={styles.aiMsgBody} />
                ) : (
                  <LinkifiedText text={m.text} />
                )}
                {m.role === 'assistant' && i === latestAssistantIndex ? (
                  <div className={styles.aiMsgActions}>
                    <button
                      type="button"
                      className={styles.copyBtn}
                      onClick={() => speakText(m.text)}
                      aria-label="Read latest response aloud"
                    >
                      Read out
                    </button>
                    <button
                      type="button"
                      className={styles.copyBtn}
                      onClick={copyLatestResponse}
                      aria-label="Copy latest response"
                    >
                      {copyState === 'copied' ? 'Copied' : copyState === 'error' ? 'Copy failed' : 'Copy'}
                    </button>
                  </div>
                ) : null}
              </div>
            ))}
          </div>
          {error ? <p className={styles.error}>{error}</p> : null}
          <div className={styles.compose}>
            <textarea
              className={styles.input}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              disabled={busy}
              rows={3}
              placeholder={isTasksView ? 'What do I need to do today?' : 'Ask about this trip…'}
            />
            <div className={styles.composeTools}>
              <button type="button" className={styles.voiceBtn} onClick={startVoiceInput} disabled={busy}>
                {voiceListening ? 'Listening…' : 'Voice'}
              </button>
              <label className={styles.voiceToggle}>
                <input type="checkbox" checked={autoReadAnswers} onChange={(e) => setAutoReadAnswers(e.target.checked)} />
                Auto-read
              </label>
            </div>
            <button
              type="button"
              className={styles.sendBtn}
              disabled={busy || !input.trim()}
              onClick={() => void send()}
            >
              {busy ? '…' : 'Send'}
            </button>
          </div>
          <div
            className={styles.resizeHandle}
            role="separator"
            aria-label="Resize chat panel"
            title="Drag to resize"
            onPointerDown={onResizePointerDown}
            onPointerMove={onResizePointerMove}
            onPointerUp={onResizePointerUp}
            onPointerCancel={onResizePointerUp}
          />
        </div>
      ) : null}
    </>
  );
};
