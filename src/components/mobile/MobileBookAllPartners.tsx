import * as React from 'react';
import { useAppConfig } from '../../context/AppConfigContext';
import { useShellMode } from '../../hooks/useShellMode';
import {
  BOOKING_AFFILIATES_CONFIG_KEY,
  resolveBookingAffiliatePartners
} from '../../utils/bookingAffiliateLinks';
import { BookingPartnerCard } from './BookingPartnerCard';
import styles from './MobileBookAllPartners.module.css';

export interface MobileBookAllPartnersProps {
  destinationHint?: string;
  onBack: () => void;
}

export const MobileBookAllPartners: React.FC<MobileBookAllPartnersProps> = ({ destinationHint = '', onBack }) => {
  const { appConfig } = useAppConfig();
  const shellMode = useShellMode();
  const overridesJson = appConfig.get(BOOKING_AFFILIATES_CONFIG_KEY);
  const partners = React.useMemo(
    () => resolveBookingAffiliatePartners(destinationHint, overridesJson),
    [destinationHint, overridesJson]
  );

  return (
    <div className={styles.root} data-shell={shellMode === 'ipad-portrait' ? 'ipad-portrait' : undefined}>
      <button type="button" className={styles.backBtn} onClick={onBack}>
        ← Book
      </button>
      <h2 className={styles.title}>All partners</h2>
      <p className={styles.sub}>Every booking partner available on this site.</p>
      <div className={styles.grid}>
        {partners.map((p) => (
          <BookingPartnerCard key={p.id} partner={p} variant="grid" />
        ))}
      </div>
    </div>
  );
};
