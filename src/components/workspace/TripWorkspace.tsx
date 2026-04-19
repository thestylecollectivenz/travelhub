import * as React from 'react';
import { TripWorkspaceProvider, useTripWorkspace } from '../../context/TripWorkspaceContext';
import { TripHero } from './TripHero';
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
      <div className={styles.statsSlot} role="note">
        Stats strip (task 2.3)
      </div>
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
