import * as React from 'react';
import * as ReactDOM from 'react-dom';
import { useConfig } from '../../context/ConfigContext';
import { usePlaces } from '../../context/PlacesContext';
import { useTripWorkspace } from '../../context/TripWorkspaceContext';
import {
  generateItineraryAiSuggestions,
  type ItineraryAiSuggestionCard
} from '../../services/GeminiService';
import { formatGeminiUserMessage } from '../../services/geminiErrorMessage';
import { buildAiCurrentFocusBlock, buildTripDayAiContext } from '../../utils/buildTripDayAiContext';
import { placeDisplayLabel } from '../../utils/placeDisplayLabel';
import { placeQueryMapsUrl, placeWebsiteSearchUrl } from '../../utils/googleMapsLink';
import { NearYouResultCard, type NearYouResultCardData } from './NearYouResultCard';
import styles from './MobileAskAiResultsSheet.module.css';

export interface MobileAskAiResultsSheetProps {
  prompt: string;
  onClose: () => void;
}

function cardToResult(card: ItineraryAiSuggestionCard): NearYouResultCardData {
  return {
    id: card.id,
    name: card.name,
    note: [card.description, card.travelTime].filter(Boolean).join(' · '),
    rating: card.rating,
    priceLevel: card.priceLevel,
    mapsUrl: card.mapsUrl || placeQueryMapsUrl(card.name),
    websiteUrl: card.websiteUrl || placeWebsiteSearchUrl(card.name),
    aiBlurb: card.aiBlurb || card.description,
    topPick: card.topPick
  };
}

export const MobileAskAiResultsSheet: React.FC<MobileAskAiResultsSheetProps> = ({ prompt, onClose }) => {
  const { config } = useConfig();
  const { trip, tripDays, localEntries, selectedDayId } = useTripWorkspace();
  const { placeById } = usePlaces();
  const [busy, setBusy] = React.useState(true);
  const [error, setError] = React.useState('');
  const [intro, setIntro] = React.useState('');
  const [cards, setCards] = React.useState<ItineraryAiSuggestionCard[]>([]);
  const [chips, setChips] = React.useState<string[]>([]);
  const [refine, setRefine] = React.useState('');

  const day = tripDays.find((d) => d.id === selectedDayId) ?? tripDays[0];
  const place = day?.primaryPlaceId ? placeById(day.primaryPlaceId) : undefined;
  const placeTitle = place ? placeDisplayLabel(place) : undefined;

  const focusBlock = React.useMemo(
    () =>
      buildAiCurrentFocusBlock({
        isTasksView: false,
        dayScope: 'day',
        selectedDay: day,
        placeTitle,
        mainWorkspaceTab: 'plan'
      }),
    [day, placeTitle]
  );
  const tripContext = React.useMemo(() => {
    if (!trip) return '';
    return buildTripDayAiContext({
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
    });
  }, [trip, tripDays, day, localEntries, placeTitle, placeById]);

  const run = React.useCallback(
    async (question: string): Promise<void> => {
      const apiKey = (config.geminiApiKey || '').trim();
      if (!apiKey) {
        setError('Add a Gemini API key in Profile / User settings.');
        setBusy(false);
        return;
      }
      setBusy(true);
      setError('');
      try {
        const result = await generateItineraryAiSuggestions(apiKey, question, trip ? tripContext : '', focusBlock);
        setIntro(result.intro);
        setCards(result.cards);
        setChips(result.chips);
      } catch (err) {
        setError(formatGeminiUserMessage(err));
        setCards([]);
      } finally {
        setBusy(false);
      }
    },
    [config.geminiApiKey, focusBlock, tripContext]
  );

  React.useEffect(() => {
    void run(prompt);
  }, [prompt, run]);

  React.useEffect(() => {
    const onKey = (ev: KeyboardEvent): void => {
      if (ev.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [onClose]);

  return ReactDOM.createPortal(
    <div className={styles.backdrop} role="presentation" onClick={onClose}>
      <div className={styles.sheet} role="dialog" aria-modal="true" aria-label="Ask AI results" onClick={(e) => e.stopPropagation()}>
        <header className={styles.header}>
          <p className={styles.kicker}>
            <span aria-hidden>✦</span> Here&apos;s your answer
          </p>
          <button type="button" className={styles.closeBtn} onClick={onClose} aria-label="Close">
            ×
          </button>
        </header>
        <p className={styles.question}>Q: {prompt}</p>
        {busy ? <p className={styles.muted}>Thinking…</p> : null}
        {error ? <p className={styles.error}>{error}</p> : null}
        {!busy && intro ? <p className={styles.intro}>{intro}</p> : null}
        <div className={styles.list}>
          {cards.map((card) => (
            <NearYouResultCard
              key={card.id}
              result={cardToResult(card)}
              categoryLabel={card.type === 'tip' ? 'Tip' : card.type === 'attraction' ? 'Sight' : 'Place'}
            />
          ))}
        </div>
        {chips.length ? (
          <div className={styles.chips}>
            {chips.map((chip) => (
              <button
                key={chip}
                type="button"
                className={styles.chip}
                onClick={() => {
                  setRefine(chip);
                  void run(`${prompt} — ${chip}`);
                }}
              >
                {chip}
              </button>
            ))}
          </div>
        ) : null}
        <div className={styles.refineRow}>
          <input
            className={styles.refineInput}
            value={refine}
            onChange={(e) => setRefine(e.target.value)}
            placeholder="Refine this answer…"
            onKeyDown={(e) => {
              if (e.key === 'Enter' && refine.trim()) void run(`${prompt} — ${refine.trim()}`);
            }}
          />
          <button
            type="button"
            className={styles.sendBtn}
            disabled={busy || !refine.trim()}
            onClick={() => refine.trim() && void run(`${prompt} — ${refine.trim()}`)}
          >
            Send
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
};
