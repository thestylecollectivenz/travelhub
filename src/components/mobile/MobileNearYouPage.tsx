import * as React from 'react';
import { NEAR_YOU_TOOLS, type NearYouToolId } from '../../utils/nearYouTools';
import { NearYouToolIcon } from '../shared/NearYouToolIcon';
import { useShellMode } from '../../hooks/useShellMode';
import { MobileNearYouResults } from './MobileNearYouResults';
import { MobileFindSavedRow } from './MobileFindSavedRow';
import styles from './MobileNearYouPage.module.css';

export interface MobileNearYouPageProps {
  onBack: () => void;
  /** When set, open straight into results for this tool. */
  initialToolId?: NearYouToolId | null;
  tripTitle?: string;
  tripDateRange?: string;
  onAddToItinerary?: (place: { name: string; note?: string; mapsUrl?: string; websiteUrl?: string }) => void;
  onSavePlace?: (place: { name: string; note?: string; mapsUrl?: string; websiteUrl?: string; toolId?: string }) => void;
}

export const MobileNearYouPage: React.FC<MobileNearYouPageProps> = ({
  onBack,
  initialToolId = null,
  tripTitle,
  tripDateRange,
  onAddToItinerary,
  onSavePlace
}) => {
  const [toolId, setToolId] = React.useState<NearYouToolId | null>(initialToolId);

  const shellMode = useShellMode();

  React.useEffect(() => {
    setToolId(initialToolId ?? null);
  }, [initialToolId]);

  if (toolId) {
    return (
      <MobileNearYouResults
        toolId={toolId}
        onBack={() => {
          if (initialToolId) onBack();
          else setToolId(null);
        }}
        tripTitle={tripTitle}
        tripDateRange={tripDateRange}
        onAddToItinerary={onAddToItinerary}
        onSavePlace={onSavePlace}
      />
    );
  }

  return (
    <div className={styles.root} data-shell={shellMode === 'ipad-portrait' ? 'ipad-portrait' : undefined}>
      <div className={styles.backRow}>
        <button type="button" className={styles.backBtn} onClick={onBack}>
          ← Home
        </button>
      </div>
      <h2 className={styles.title}>Near you</h2>
      <p className={styles.intro}>Uses your device GPS. Pick a category to open the full results page.</p>
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
            <MobileFindSavedRow toolId={tool.id} />
          </div>
        ))}
      </div>
    </div>
  );
};
