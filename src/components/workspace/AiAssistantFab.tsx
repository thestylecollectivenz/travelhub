import * as React from 'react';
import { useConfig } from '../../context/ConfigContext';
import { useTripWorkspace } from '../../context/TripWorkspaceContext';
import { answerTravelChat } from '../../services/GeminiService';
import { formatGeminiUserMessage } from '../../services/geminiErrorMessage';
import { LinkifiedText } from '../shared/LinkifiedText';
import styles from './AiAssistantFab.module.css';

export const AiAssistantFab: React.FC = () => {
  const { config } = useConfig();
  const { trip } = useTripWorkspace();
  const [open, setOpen] = React.useState(false);
  const [input, setInput] = React.useState('');
  const [busy, setBusy] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [messages, setMessages] = React.useState<Array<{ role: 'user' | 'assistant'; text: string }>>([]);

  const tripContext = trip
    ? `${trip.title}${trip.destination ? ` — ${trip.destination}` : ''}${trip.dateStart ? ` (${trip.dateStart.slice(0, 10)} to ${trip.dateEnd?.slice(0, 10) ?? ''})` : ''}`
    : '';

  const send = async (): Promise<void> => {
    const text = input.trim();
    if (!text || busy) return;
    if (!config.geminiApiKey?.trim()) {
      setError('Add a Gemini API key in User settings.');
      return;
    }
    const nextMessages = [...messages, { role: 'user' as const, text }];
    setMessages(nextMessages);
    setInput('');
    setError(null);
    setBusy(true);
    try {
      const { answer } = await answerTravelChat(config.geminiApiKey, nextMessages, tripContext);
      setMessages((prev) => [...prev, { role: 'assistant', text: answer }]);
    } catch (err) {
      setError(formatGeminiUserMessage(err));
      setMessages((prev) => prev.slice(0, -1));
      setInput(text);
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      <button
        type="button"
        className={styles.fab}
        aria-label="Chat with AI"
        title="Chat with AI"
        onClick={() => setOpen((v) => !v)}
      >
        ✦
      </button>
      {open ? (
        <div className={styles.panel} role="dialog" aria-label="Travel AI chat">
          <div className={styles.head}>
            <strong>Travel AI</strong>
            <button type="button" className={styles.closeBtn} onClick={() => setOpen(false)} aria-label="Close">
              ×
            </button>
          </div>
          <div className={styles.thread}>
            {!messages.length ? (
              <p className={styles.hint}>Ask anything about this trip — routes, stations, timing, local tips…</p>
            ) : null}
            {messages.map((m, i) => (
              <div key={i} className={m.role === 'user' ? styles.userMsg : styles.aiMsg}>
                <LinkifiedText text={m.text} />
              </div>
            ))}
          </div>
          {error ? <p className={styles.error}>{error}</p> : null}
          <div className={styles.compose}>
            <textarea
              className={styles.input}
              rows={2}
              value={input}
              placeholder="e.g. Which train station for Rotterdam → Den Haag?"
              disabled={busy}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault();
                  void send();
                }
              }}
            />
            <button type="button" className={styles.sendBtn} disabled={busy || !input.trim()} onClick={() => void send()}>
              {busy ? '…' : 'Send'}
            </button>
          </div>
        </div>
      ) : null}
    </>
  );
};
