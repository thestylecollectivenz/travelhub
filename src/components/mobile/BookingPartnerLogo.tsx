import * as React from 'react';
import styles from './BookingPartnerLogo.module.css';

export interface BookingPartnerLogoProps {
  label: string;
  logoUrl: string;
  size?: 'md' | 'sm' | 'xl';
}

export const BookingPartnerLogo: React.FC<BookingPartnerLogoProps> = ({ label, logoUrl, size = 'md' }) => {
  const [failed, setFailed] = React.useState(false);
  const initials = label.trim().slice(0, 2).toUpperCase() || 'P';
  const sizeClass = size === 'sm' ? styles.logoSm : size === 'xl' ? styles.logoXl : '';

  return (
    <span className={`${styles.logo} ${sizeClass}`.trim()} aria-hidden>
      {!failed ? (
        <img className={styles.img} src={logoUrl} alt="" onError={() => setFailed(true)} />
      ) : (
        <span className={styles.fallback}>{initials}</span>
      )}
    </span>
  );
};
