import * as React from 'react';
import * as ReactDOM from 'react-dom';
import { useConfig } from '../../context/ConfigContext';
import { useSpContext } from '../../context/SpContext';
import { TripRoleProvider } from '../../context/TripRoleContext';
import { useTripPermissions } from '../../hooks/useTripPermissions';
import { TripService } from '../../services/TripService';
import { DayService } from '../../services/DayService';
import { ItineraryService } from '../../services/ItineraryService';
import { PlaceService } from '../../services/PlaceService';
import {
  generateItineraryAiSuggestions,
  type ItineraryAiSuggestionCard
} from '../../services/GeminiService';
import { formatGeminiUserMessage } from '../../services/geminiErrorMessage';
import { ReminderService } from '../../services/ReminderService';
import { buildAiCurrentFocusBlock, buildTripDayAiContext } from '../../utils/buildTripDayAiContext';
import { placeDisplayLabel } from '../../utils/placeDisplayLabel';
import { placeQueryDirectionsUrl, placeQueryMapsUrl, placeWebsiteSearchUrl } from '../../utils/googleMapsLink';
import { bookingPartnerSearchUrls } from '../../utils/bookingStatusUtils';
import { todayYmdLocal } from '../../utils/tripListSort';
import type { Trip } from '../../models';
import type { TripDay } from '../../models/TripDay';
import type { ItineraryEntry } from '../../models/ItineraryEntry';
import type { Place } from '../../models/Place';
import { NearYouResultCard, type NearYouResultCardAction, type NearYouResultCardData } from './NearYouResultCard';
import styles from './MobileAskAiResultsSheet.module.css';

export interface MobileHomeAskAiSheetProps {
  tripId: string;
  prompt: string;
  onClose: () => void;
  onAddToItinerary?: (place: { name: string; note?: string; mapsUrl?: string; websiteUrl?: string }) => void;
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

function pickContextDay(tripDays: TripDay[], todayYmd: string): TripDay | undefined {
  const sorted = tripDays.filter((d) => d.dayNumber > 0).sort((a, b) => a.dayNumber - b.dayNumber);
  return sorted.find((d) => (d.calendarDate || '').slice(0, 10) >= todayYmd) ?? sorted[0];
}

const AskAiSheetBody: React.FC<{
  trip: Trip;
  tripDays: TripDay[];
  entries: ItineraryEntry[];
  places: Place[];
  prompt: string;
  onClose: () => void;
  onAddToItinerary?: MobileHomeAskAiSheetProps['onAddToItinerary'];
}> = ({ trip, tripDays, entries, places, prompt, onClose, onAddToItinerary }) => {
  const { config } = useConfig();
  const spContext = useSpContext();
  const { canEditItinerary } = useTripPermissions();
  const [busy, setBusy] = React.useState(true);
  const [error, setError] = React.useState('');
  const [intro, setIntro] = React.useState('');
  const [cards, setCards] = React.useState<ItineraryAiSuggestionCard[]>([]);
  const [chips, setChips] = React.useState<string[]>([]);
  const [refine, setRefine] = React.useState('');
  const [actionMsg, setActionMsg] = React.useState('');

  const placeById = React.useMemo(() => new Map(places.map((p) => [p.id, p])), [places]);
  const todayYmd = todayYmdLocal();
  const day = pickContextDay(tripDays, todayYmd);
  const place = day?.primaryPlaceId ? placeById.get(day.primaryPlaceId) : undefined;
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

  const tripContext = React.useMemo(
    () =>
      buildTripDayAiContext({
        trip,
        tripDays,
        day,
        entries,
        placeTitle,
        placeForDay: (d) => {
          const p = d.primaryPlaceId ? placeById.get(d.primaryPlaceId) : undefined;
          return p;
        },
        daySpecific: false
      }),
    [trip, tripDays, day, entries, placeTitle, placeById]
  );

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
        const result = await generateItineraryAiSuggestions(apiKey, question, tripContext, focusBlock);
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

  const createTaskForCard = React.useCallback(
    async (card: ItineraryAiSuggestionCard): Promise<void> => {
      try {
        const svc = new ReminderService(spContext);
        await svc.create({
          tripId: trip.id,
          title: card.name,
          reminderText: [card.description, card.aiBlurb].filter(Boolean).join(' — '),
          reminderType: 'Manual',
          taskCategory: 'To Do',
          isComplete: false,
          dueDate: day?.calendarDate?.slice(0, 10)
        });
        setActionMsg(`Task created: ${card.name}`);
        window.setTimeout(() => setActionMsg(''), 2500);
      } catch {
        setActionMsg('Could not create task.');
        window.setTimeout(() => setActionMsg(''), 2500);
      }
    },
    [trip.id, spContext, day?.calendarDate]
  );

  const buildCardActions = (card: ItineraryAiSuggestionCard): NearYouResultCardAction[] => {
    const maps = card.mapsUrl || placeQueryMapsUrl(card.name);
    const website = card.websiteUrl || placeWebsiteSearchUrl(card.name);
    const add =
      canEditItinerary && onAddToItinerary
        ? (): void => {
            void onAddToItinerary({
              name: card.name,
              note: card.description,
              mapsUrl: maps,
              websiteUrl: website
            });
          }
        : undefined;

    if (card.type === 'tip') {
      return [
        { id: 'task', label: 'Create task', onClick: () => void createTaskForCard(card) },
        { id: 'locate', label: 'Locate', href: placeQueryDirectionsUrl(card.name) || maps, disabled: !maps }
      ];
    }

    if (card.type === 'place' || card.type === 'attraction' || card.type === 'activity' || card.type === 'restaurant') {
      const actions: NearYouResultCardAction[] = [];
      if (add) actions.push({ id: 'add', label: 'Add', onClick: add });
      actions.push({ id: 'view', label: 'View', href: website, disabled: !website });
      actions.push({ id: 'locate', label: 'Locate', href: maps, disabled: !maps });
      return actions;
    }

    const bookUrl = bookingPartnerSearchUrls(card.name)[0]?.href || website;
    const actions: NearYouResultCardAction[] = [
      { id: 'view', label: 'View', href: website, disabled: !website },
      { id: 'locate', label: 'Locate', href: maps, disabled: !maps },
      { id: 'book', label: 'Book', href: bookUrl, disabled: !bookUrl }
    ];
    if (add) actions.unshift({ id: 'add', label: 'Add', onClick: add });
    return actions;
  };

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
        {actionMsg ? <p className={styles.muted}>{actionMsg}</p> : null}
        {!busy && intro ? <p className={styles.intro}>{intro}</p> : null}
        <div className={styles.list}>
          {cards.map((card) => (
            <NearYouResultCard
              key={card.id}
              result={cardToResult(card)}
              categoryLabel={card.type === 'tip' ? 'Tip' : card.type === 'attraction' ? 'Sight' : 'Place'}
              actions={buildCardActions(card)}
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

export const MobileHomeAskAiSheet: React.FC<MobileHomeAskAiSheetProps> = ({
  tripId,
  prompt,
  onClose,
  onAddToItinerary
}) => {
  const spContext = useSpContext();
  const [trip, setTrip] = React.useState<Trip | null>(null);
  const [tripDays, setTripDays] = React.useState<TripDay[]>([]);
  const [entries, setEntries] = React.useState<ItineraryEntry[]>([]);
  const [places, setPlaces] = React.useState<Place[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [loadError, setLoadError] = React.useState('');

  React.useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setLoadError('');
    const tripSvc = new TripService(spContext);
    const daySvc = new DayService(spContext);
    const entrySvc = new ItineraryService(spContext);
    const placeSvc = new PlaceService(spContext);
    void Promise.all([
      tripSvc.getById(tripId),
      daySvc.getAll(tripId),
      entrySvc.getAll(tripId),
      placeSvc.getAll()
    ])
      .then(([t, days, ents, pls]) => {
        if (cancelled) return;
        if (!t) {
          setLoadError('Trip not found.');
          return;
        }
        setTrip(t);
        setTripDays(days);
        setEntries(ents);
        setPlaces(pls);
      })
      .catch(() => {
        if (!cancelled) setLoadError('Could not load trip data.');
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [tripId, spContext]);

  if (loading) {
    return ReactDOM.createPortal(
      <div className={styles.backdrop} role="presentation" onClick={onClose}>
        <div className={styles.sheet} role="dialog" aria-modal="true" aria-label="Ask AI results" onClick={(e) => e.stopPropagation()}>
          <p className={styles.muted}>Loading…</p>
        </div>
      </div>,
      document.body
    );
  }

  if (loadError || !trip) {
    return ReactDOM.createPortal(
      <div className={styles.backdrop} role="presentation" onClick={onClose}>
        <div className={styles.sheet} role="dialog" aria-modal="true" aria-label="Ask AI results" onClick={(e) => e.stopPropagation()}>
          <p className={styles.error}>{loadError || 'Trip not found.'}</p>
          <button type="button" className={styles.closeBtn} onClick={onClose}>
            Close
          </button>
        </div>
      </div>,
      document.body
    );
  }

  return (
    <TripRoleProvider tripId={tripId}>
      <AskAiSheetBody
        trip={trip}
        tripDays={tripDays}
        entries={entries}
        places={places}
        prompt={prompt}
        onClose={onClose}
        onAddToItinerary={onAddToItinerary}
      />
    </TripRoleProvider>
  );
};
