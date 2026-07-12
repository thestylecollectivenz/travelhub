import * as React from 'react';
import * as ReactDOM from 'react-dom';
import { useConfig } from '../../context/ConfigContext';
import { useAttachments } from '../../context/AttachmentsContext';
import { usePlaces } from '../../context/PlacesContext';
import { useSpContext } from '../../context/SpContext';
import { useTripWorkspace } from '../../context/TripWorkspaceContext';
import { useTripPermissions } from '../../hooks/useTripPermissions';
import {
  generateItineraryAiSuggestions,
  type ItineraryAiSuggestionCard
} from '../../services/GeminiService';
import { formatGeminiUserMessage } from '../../services/geminiErrorMessage';
import { ReminderService } from '../../services/ReminderService';
import { buildAiCurrentFocusBlock, buildTripDayAiContext } from '../../utils/buildTripDayAiContext';
import { placeDisplayLabel } from '../../utils/placeDisplayLabel';
import { placeQueryDirectionsUrl, placeQueryMapsUrl, placeWebsiteSearchUrl } from '../../utils/googleMapsLink';
import {
  bookingPartnerSearchUrls,
  findBoardingPassDocument,
  findConfirmationDocument,
  findDeckPlanDocument
} from '../../utils/bookingStatusUtils';
import { NearYouResultCard, type NearYouResultCardAction, type NearYouResultCardData } from './NearYouResultCard';
import styles from './MobileAskAiResultsSheet.module.css';

export interface MobileAskAiResultsSheetProps {
  prompt: string;
  onClose: () => void;
  onSavePlace?: (place: { name: string; note?: string; mapsUrl?: string }) => void;
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

function matchItineraryEntry(name: string, entries: import('../../models/ItineraryEntry').ItineraryEntry[]) {
  const n = name.toLowerCase().trim();
  if (!n) return undefined;
  const exact = entries.find((e) => (e.title || '').toLowerCase().trim() === n);
  if (exact) return exact;
  return entries.find((e) => {
    const t = (e.title || '').toLowerCase().trim();
    return t && (t.includes(n) || n.includes(t));
  });
}

export const MobileAskAiResultsSheet: React.FC<MobileAskAiResultsSheetProps> = ({
  prompt,
  onClose,
  onSavePlace,
  onAddToItinerary
}) => {
  const { config } = useConfig();
  const spContext = useSpContext();
  const { documents } = useAttachments();
  const { canEditItinerary } = useTripPermissions();
  const { trip, tripDays, localEntries, selectedDayId } = useTripWorkspace();
  const { placeById } = usePlaces();
  const [busy, setBusy] = React.useState(true);
  const [error, setError] = React.useState('');
  const [intro, setIntro] = React.useState('');
  const [cards, setCards] = React.useState<ItineraryAiSuggestionCard[]>([]);
  const [chips, setChips] = React.useState<string[]>([]);
  const [refine, setRefine] = React.useState('');
  const [actionMsg, setActionMsg] = React.useState('');

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
    [config.geminiApiKey, focusBlock, tripContext, trip]
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
      if (!trip?.id) return;
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
    [trip?.id, spContext, day?.calendarDate]
  );

  const buildCardActions = (card: ItineraryAiSuggestionCard): NearYouResultCardAction[] => {
    const matched = matchItineraryEntry(card.name, localEntries);
    const maps = card.mapsUrl || placeQueryMapsUrl(card.name);
    const website = card.websiteUrl || placeWebsiteSearchUrl(card.name);
    const save = onSavePlace
      ? (): void => {
          onSavePlace({ name: card.name, note: card.description, mapsUrl: maps });
          setActionMsg(`Saved ${card.name}`);
          window.setTimeout(() => setActionMsg(''), 2200);
        }
      : undefined;
    const add = canEditItinerary && onAddToItinerary
      ? (): void => {
          void onAddToItinerary({
            name: card.name,
            note: card.description,
            mapsUrl: maps,
            websiteUrl: website
          });
        }
      : undefined;

    if (matched?.category === 'Accommodation') {
      const entryDocs = documents.filter((d) => d.entryId === matched.id);
      const confirmation = findConfirmationDocument(entryDocs);
      const actions: NearYouResultCardAction[] = [
        {
          id: 'booking',
          label: 'Open booking',
          href: confirmation?.fileUrl,
          disabled: !confirmation?.fileUrl
        }
      ];
      if (matched.phoneNumber?.trim()) {
        actions.push({ id: 'call', label: 'Call', href: `tel:${matched.phoneNumber.trim()}` });
      }
      return actions;
    }

    if (matched?.category === 'Cruise') {
      const entryDocs = documents.filter((d) => d.entryId === matched.id);
      const boarding = findBoardingPassDocument(entryDocs);
      const deck = findDeckPlanDocument(entryDocs);
      return [
        {
          id: 'boarding',
          label: 'Boarding pass',
          href: boarding?.fileUrl,
          disabled: !boarding?.fileUrl
        },
        {
          id: 'deck',
          label: 'Deck plan',
          href: deck?.fileUrl,
          disabled: !deck?.fileUrl
        }
      ];
    }

    if (card.type === 'tip') {
      return [
        { id: 'task', label: 'Create task', onClick: () => void createTaskForCard(card) },
        { id: 'directions', label: 'Directions', href: placeQueryDirectionsUrl(card.name) || maps, disabled: !maps }
      ];
    }

    if (card.type === 'attraction') {
      const actions: NearYouResultCardAction[] = [
        { id: 'info', label: 'View info', href: website || maps, disabled: !website && !maps }
      ];
      if (add) actions.unshift({ id: 'add', label: 'Add to itinerary', onClick: add });
      return actions;
    }

    if (card.type === 'place') {
      return [
        { id: 'view', label: 'View place', href: maps, disabled: !maps },
        ...(save ? [{ id: 'save', label: 'Save', onClick: save }] : [])
      ];
    }

    const bookUrl = bookingPartnerSearchUrls(card.name)[0]?.href || website;
    const actions: NearYouResultCardAction[] = [
      { id: 'book', label: 'Book', href: bookUrl, disabled: !bookUrl }
    ];
    if (add) actions.push({ id: 'add', label: 'Add to itinerary', onClick: add });
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
