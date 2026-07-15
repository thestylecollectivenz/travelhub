import * as React from 'react';
import { NEAR_YOU_TOOLS, type NearYouToolId } from '../../utils/nearYouTools';
import { nearToolToExploreCategory } from '../../utils/exploreCategories';
import { NearYouToolIcon } from '../shared/NearYouToolIcon';
import { useShellMode } from '../../hooks/useShellMode';
import { useContinuousSpeechInput } from '../../hooks/useContinuousSpeechInput';
import { MobileExplorePlacesView } from './MobileExplorePlacesView';
import { MobileFindSavedRow } from './MobileFindSavedRow';
import styles from './MobileNearYouPage.module.css';

export interface MobileNearYouPageProps {
  onBack: () => void;
  onOpenAllSaved?: () => void;
  /** When set, open straight into results for this tool. */
  initialToolId?: NearYouToolId | null;
  tripId?: string;
  tripTitle?: string;
  tripDateRange?: string;
  onAddToItinerary?: (place: { name: string; note?: string; mapsUrl?: string; websiteUrl?: string }) => void;
  onSavePlace?: (place: { name: string; note?: string; mapsUrl?: string; websiteUrl?: string; toolId?: string }) => void;
  /** Home-style AI search above Near you tools/results. */
  onAskAi?: (prompt: string) => void;
  askAiEnabled?: boolean;
  hideBack?: boolean;
}

export const MobileNearYouPage: React.FC<MobileNearYouPageProps> = ({
  onBack,
  onOpenAllSaved,
  initialToolId = null,
  tripId,
  tripTitle,
  tripDateRange,
  onAddToItinerary,
  onSavePlace,
  onAskAi,
  askAiEnabled = false,
  hideBack = false
}) => {
  const [toolId, setToolId] = React.useState<NearYouToolId | null>(initialToolId);
  const [aiPrompt, setAiPrompt] = React.useState('');
  const shellMode = useShellMode();

  const appendVoice = React.useCallback((chunk: string) => {
    setAiPrompt((prev) => `${prev}${prev && !/\s$/.test(prev) ? ' ' : ''}${chunk}`.trimStart());
  }, []);
  const { listening, toggleListening } = useContinuousSpeechInput(appendVoice);

  React.useEffect(() => {
    setToolId(initialToolId ?? null);
  }, [initialToolId]);

  const submitAsk = (): void => {
    const p = aiPrompt.trim();
    if (!p || !onAskAi || !askAiEnabled) return;
    onAskAi(p);
    setAiPrompt('');
  };

  const aiBar =
    onAskAi ? (
      <form
        className={styles.aiRow}
        onSubmit={(e) => {
          e.preventDefault();
          submitAsk();
        }}
      >
        <span className={styles.aiSpark} aria-hidden>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
            <path
              d="M12 3l1.2 4.2L17 8.5l-3.8 1.3L12 14l-1.2-4.2L7 8.5l3.8-1.3L12 3zM6 14l.7 2.3L9 17l-2.3.7L6 20l-.7-2.3L3 17l2.3-.7L6 14zM17 13l.6 2L20 16l-2.4.6L17 19l-.6-2.4L14 16l2.4-.6L17 13z"
              fill="currentColor"
            />
          </svg>
        </span>
        <input
          className={styles.aiInput}
          value={aiPrompt}
          onChange={(e) => setAiPrompt(e.target.value)}
          placeholder="Ask AI anything near you…"
          aria-label="Ask AI near you"
          disabled={!askAiEnabled}
        />
        <button
          type="button"
          className={`${styles.aiMic} ${listening ? styles.aiMicActive : ''}`}
          aria-label={listening ? 'Stop listening' : 'Speak your question'}
          onClick={() => toggleListening()}
          disabled={!askAiEnabled}
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden>
            <rect x="9" y="3" width="6" height="11" rx="3" stroke="currentColor" strokeWidth="1.8" />
            <path d="M6 11a6 6 0 0 0 12 0M12 17v4" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
          </svg>
        </button>
        <button type="submit" className={styles.aiGo} aria-label="Ask AI" disabled={!askAiEnabled || !aiPrompt.trim()}>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden>
            <path d="M4 12h12M12 6l6 6-6 6" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </button>
      </form>
    ) : null;

  if (toolId) {
    return (
      <MobileExplorePlacesView
        mode="gps"
        initialCategory={nearToolToExploreCategory(toolId)}
        onBack={() => {
          if (initialToolId) onBack();
          else setToolId(null);
        }}
        onAddToItinerary={onAddToItinerary}
        onSavePlace={onSavePlace}
      />
    );
  }

  return (
    <div className={styles.root} data-shell={shellMode === 'ipad-portrait' ? 'ipad-portrait' : undefined}>
      {hideBack ? null : (
        <div className={styles.backRow}>
          <button type="button" className={styles.backBtn} onClick={onBack}>
            {'< Home'}
          </button>
        </div>
      )}
      {aiBar}
      <h2 className={styles.title}>Near you</h2>
      <p className={styles.intro}>Uses your device GPS. Pick a category to open the full results page.</p>
      {tripId && onOpenAllSaved ? (
        <button type="button" className={styles.allSavedLink} onClick={onOpenAllSaved}>
          All saved places
          <span aria-hidden> ›</span>
        </button>
      ) : null}
      <div className={styles.list}>
        {NEAR_YOU_TOOLS.map((tool) => (
          <div key={tool.id} className={styles.categoryWrap}>
            <button type="button" className={styles.categoryCard} onClick={() => setToolId(tool.id)}>
              <NearYouToolIcon toolId={tool.id} size="lg" />
              <span>
                <span className={styles.categoryLabel}>{tool.label}</span>
                <span className={styles.categoryDesc}>{tool.description}</span>
              </span>
            </button>
            <MobileFindSavedRow toolId={tool.id} tripId={tripId} />
          </div>
        ))}
      </div>
    </div>
  );
};
