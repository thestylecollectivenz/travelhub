import * as React from 'react';
import { TripWorkspaceProvider, useTripWorkspace } from '../../context/TripWorkspaceContext';
import { TripHero } from './TripHero';
import { TripStatsStrip } from './TripStatsStrip';
import { TripContent } from './TripContent';
import styles from './TripWorkspace.module.css';

export interface ITripWorkspaceProps {
  tripId: string;
  onBack: () => void;
}

const TripWorkspaceLayout: React.FC<ITripWorkspaceProps> = ({ tripId, onBack }) => {
  const { trip } = useTripWorkspace();

  return (
    <div className={styles.workspace} data-trip-id={tripId}>
      <div className={styles.toolbar}>
        <button type="button" className={styles.backButton} onClick={onBack}>
          ← All Trips
        </button>
      </div>
      <TripHero trip={trip} />
      <TripStatsStrip />
      <TripContent />
    </div>
  );
};

export const TripWorkspace: React.FC<ITripWorkspaceProps> = (props) => {
  return (
    <TripWorkspaceProvider>
      <TripWorkspaceLayout {...props} />
    </TripWorkspaceProvider>
  );
};
