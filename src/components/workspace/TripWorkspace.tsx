import * as React from 'react';
import { TripWorkspaceProvider } from '../../context/TripWorkspaceContext';
import { TripContent } from './TripContent';
import styles from './TripWorkspace.module.css';

export interface ITripWorkspaceProps {
  tripId: string;
  onBack: () => void;
}

export const TripWorkspace: React.FC<ITripWorkspaceProps> = ({ tripId, onBack }) => {
  return (
    <TripWorkspaceProvider>
      <div className={styles.workspace} data-trip-id={tripId}>
        <div className={styles.toolbar}>
          <button type="button" className={styles.backButton} onClick={onBack}>
            ← All Trips
          </button>
        </div>
        <div className={styles.heroSlot} role="note">
          Hero (task 2.2)
        </div>
        <div className={styles.statsSlot} role="note">
          Stats strip (task 2.3)
        </div>
        <TripContent />
      </div>
    </TripWorkspaceProvider>
  );
};
