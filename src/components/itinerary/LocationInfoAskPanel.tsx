import * as React from 'react';
import type { ItineraryEntry } from '../../models/ItineraryEntry';
import type { Place } from '../../models/Place';
import type { LocationInfoNotes } from '../../utils/locationInfoEntry';
import { useSpContext } from '../../context/SpContext';
import { subscribeLocationInfoAIStatus } from '../../utils/locationInfoAIEvents';
import { scheduleLocationInfoQuestion } from '../../utils/locationInfoGeneration';
import styles from './LocationInfoAskPanel.module.css';

export interface LocationInfoAskPanelProps {
  entry: ItineraryEntry;
  place: Place | undefined;
  data: LocationInfoNotes;
  geminiApiKey: string;
  readOnly?: boolean;
  onOpenSettings?: () => void;
}

export const LocationInfoAskPanel: React.FC<LocationInfoAskPanelProps> = ({
  entry,
  place,
  data,
  geminiApiKey,
  readOnly = false,
  onOpenSettings
}) => {
  const spContext = useSpContext();
  const [question, setQuestion] = React.useState('');
  const [asking, setAsking] = React.useState(false);
  const [askError, setAskError] = React.useState<string | undefined>();

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

  const submitQuestion = (): void => {
    if (!place || !hasKey || readOnly) return;
    const q = question.trim();
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
              <div className={styles.answer}>{item.answer}</div>
            </div>
          ))}
        </div>
      ) : null}
      {!readOnly ? (
        <div className={styles.askRow}>
          <textarea
            className={styles.askInput}
            rows={2}
            value={question}
            placeholder="e.g. Best half-day walk with kids? Local SIM or eSIM?"
            disabled={asking || !hasKey || !place}
            onChange={(e) => setQuestion(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                submitQuestion();
              }
            }}
          />
          <div className={styles.askActions}>
            <button
              type="button"
              className={styles.askBtn}
              disabled={asking || !hasKey || !place || !question.trim()}
              onClick={submitQuestion}
            >
              {asking ? 'Asking…' : 'Ask AI'}
            </button>
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
          {askError ? <p className={styles.error}>{askError}</p> : null}
        </div>
      ) : null}
    </section>
  );
};
