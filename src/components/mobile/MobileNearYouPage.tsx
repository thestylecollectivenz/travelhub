import * as React from 'react';
import { NEAR_YOU_TOOLS, type NearYouToolId } from '../../utils/nearYouTools';
import { MobileNearYouResults } from './MobileNearYouResults';
import styles from './MobileHome.module.css';

export interface MobileNearYouPageProps {
  onBack: () => void;
  /** When set, open straight into results for this tool. */
  initialToolId?: NearYouToolId | null;
  tripTitle?: string;
  tripDateRange?: string;
  onAddToItinerary?: (place: { name: string; note?: string; mapsUrl?: string; websiteUrl?: string }) => void;
  onSavePlace?: (place: { name: string; note?: string; mapsUrl?: string }) => void;
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
    <div>
      <div className={styles.sectionHead}>
        <button type="button" className={styles.sectionLink} onClick={onBack}>
          ← Home
        </button>
      </div>
      <h2 className={styles.sectionTitle}>Near you</h2>
      <p className={styles.feedback} style={{ marginTop: 'var(--space-3)' }}>
        Uses your device GPS. Pick a category to open the full results page.
      </p>
      <div className={styles.listStack} style={{ marginTop: 'var(--space-3)' }}>
        {NEAR_YOU_TOOLS.map((tool) => (
          <button
            key={tool.id}
            type="button"
            className={styles.secondaryBtn}
            style={{ width: '100%', textAlign: 'left', borderRadius: '1rem', padding: '0.85rem 1rem' }}
            onClick={() => setToolId(tool.id)}
          >
            <strong>{tool.label}</strong>
            <div style={{ fontSize: 'var(--font-size-xs)', color: 'var(--tl-muted)', marginTop: 4 }}>
              {tool.description}
            </div>
          </button>
        ))}
      </div>
    </div>
  );
};
