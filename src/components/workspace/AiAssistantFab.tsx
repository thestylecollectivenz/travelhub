import * as React from 'react';
import { useConfig } from '../../context/ConfigContext';
import { usePlaces } from '../../context/PlacesContext';
import { useTripWorkspace } from '../../context/TripWorkspaceContext';
import { answerTravelChat } from '../../services/GeminiService';
import { formatGeminiUserMessage } from '../../services/geminiErrorMessage';
import { LinkifiedText } from '../shared/LinkifiedText';
import { RichTextContent } from '../shared/RichTextContent';
import { loadAiChatMessages, pruneAiChatHistory, saveAiChatMessages } from '../../utils/aiChatHistory';
import { buildTripDayAiContext } from '../../utils/buildTripDayAiContext';
import { markdownToHtml } from '../../utils/markdownToHtml';
import { placeDisplayLabel } from '../../utils/placeDisplayLabel';
import styles from './AiAssistantFab.module.css';

const FAB_SIZE = 48;
const DRAG_THRESHOLD_PX = 6;
const STORAGE_KEY = 'travelhub-ai-fab-pos';

interface FabPosition {
  x: number;
  y: number;
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
  const { trip, tripDays, selectedDayId, localEntries } = useTripWorkspace();
  const { placeById } = usePlaces();
  const [open, setOpen] = React.useState(false);
  const [input, setInput] = React.useState('');
  const [busy, setBusy] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [messages, setMessages] = React.useState<Array<{ role: 'user' | 'assistant'; text: string }>>([]);
  const [copyState, setCopyState] = React.useState<'idle' | 'copied' | 'error'>('idle');
  const [dayScope, setDayScope] = React.useState<'day' | 'general'>('day');
  const [fabPos, setFabPos] = React.useState<FabPosition>(() => loadFabPosition());
  const dragRef = React.useRef<{
    pointerId: number;
    startX: number;
    startY: number;
    originX: number;
    originY: number;
    moved: boolean;
  } | null>(null);

  React.useEffect(() => {
    const onResize = (): void => {
      setFabPos((prev) => clampFabPosition(prev));
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

  const selectedDay = React.useMemo(
    () => (selectedDayId ? tripDays.find((d) => d.id === selectedDayId) : undefined),
    [selectedDayId, tripDays]
  );

  const tripContext = React.useMemo(() => {
    if (!trip) return '';
    const place = selectedDay?.primaryPlaceId ? placeById(selectedDay.primaryPlaceId) : undefined;
    const placeTitle = place ? placeDisplayLabel(place) : undefined;
    return buildTripDayAiContext({
      trip,
      tripDays,
      day: selectedDay,
      entries: localEntries,
      placeTitle,
      placeForDay: (d) => {
        const p = d.primaryPlaceId ? placeById(d.primaryPlaceId) : undefined;
        return p;
      },
      daySpecific: dayScope === 'day'
    });
  }, [trip, tripDays, selectedDay, localEntries, placeById, dayScope]);

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
      const { answer } = await answerTravelChat(config.geminiApiKey, nextMessages, tripContext);
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

  const panelWidth = Math.min(352, (typeof window !== 'undefined' ? window.innerWidth : 352) - 16);
  const panelHeight = Math.min(448, (typeof window !== 'undefined' ? window.innerHeight : 448) * 0.7);
  const panelPos = panelPosition(fabPos, panelWidth, panelHeight);

  const place = selectedDay?.primaryPlaceId ? placeById(selectedDay.primaryPlaceId) : undefined;
  const placeLabel = place ? placeDisplayLabel(place) : undefined;

  const contextHintParts: string[] = [];
  if (placeLabel) contextHintParts.push(placeLabel);
  if (selectedDay) {
    contextHintParts.push(`Day ${selectedDay.dayNumber}`);
    if (selectedDay.calendarDate) contextHintParts.push(selectedDay.calendarDate);
  }
  const contextHint = contextHintParts.length
    ? contextHintParts.join(' · ')
    : 'Select a day in the sidebar for date-specific tips';

  const latestAssistantIndex = React.useMemo(() => {
    for (let i = messages.length - 1; i >= 0; i -= 1) {
      if (messages[i].role === 'assistant') return i;
    }
    return -1;
  }, [messages]);

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
          style={{ left: panelPos.x, top: panelPos.y, width: panelWidth, maxHeight: panelHeight }}
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
          </div>
          <div className={styles.thread}>
            {!messages.length ? (
              <p className={styles.hint}>
                Ask about this trip — routes, stations, timing, local tips. Answers use the selected day and what is
                already on your itinerary.
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
              placeholder="Ask about this trip…"
            />
            <button
              type="button"
              className={styles.sendBtn}
              disabled={busy || !input.trim()}
              onClick={() => void send()}
            >
              {busy ? '…' : 'Send'}
            </button>
          </div>
        </div>
      ) : null}
    </>
  );
};
