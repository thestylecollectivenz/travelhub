import * as React from 'react';
import {
  bookingAffiliateCategoryLabel,
  type BookingAffiliateCategory,
  type ResolvedBookingAffiliatePartner
} from '../../utils/bookingAffiliateLinks';
import { useShellMode } from '../../hooks/useShellMode';
import { BookingPartnerLogo } from './BookingPartnerLogo';
import styles from './MobileBookPage.module.css';

export interface BookingPartnerCardProps {
  partner: ResolvedBookingAffiliatePartner;
  variant?: 'recommended' | 'compact' | 'grid';
}

function CategoryBadge({ category }: { category: BookingAffiliateCategory }): React.ReactElement {
  const cls =
    category === 'stays'
      ? styles.badgeStays
      : category === 'flights'
        ? styles.badgeFlights
        : category === 'tours'
          ? styles.badgeTours
          : category === 'travelMoney'
            ? styles.badgeMoney
            : category === 'transport'
              ? styles.badgeTransport
              : category === 'esim'
                ? styles.badgeEsim
                : styles.badgeAudio;
  return <span className={`${styles.badge} ${cls}`}>{bookingAffiliateCategoryLabel(category)}</span>;
}

export const BookingPartnerCard: React.FC<BookingPartnerCardProps> = ({ partner, variant = 'recommended' }) => {
  const shellMode = useShellMode();
  const isIpad = shellMode === 'ipad-portrait';

  if (variant === 'compact') {
    return (
      <a className={styles.moreCard} href={partner.href} target="_blank" rel="noopener noreferrer">
        <BookingPartnerLogo label={partner.label} logoUrl={partner.logoUrl} size="sm" />
        <span className={styles.moreName}>{partner.label}</span>
        <CategoryBadge category={partner.category} />
      </a>
    );
  }

  if (variant === 'grid') {
    return (
      <a className={styles.gridCard} href={partner.href} target="_blank" rel="noopener noreferrer">
        <BookingPartnerLogo label={partner.label} logoUrl={partner.logoUrl} size="sm" />
        <span className={styles.gridName}>{partner.label}</span>
        <CategoryBadge category={partner.category} />
      </a>
    );
  }

  return (
    <a className={styles.recCard} href={partner.href} target="_blank" rel="noopener noreferrer">
      <BookingPartnerLogo label={partner.label} logoUrl={partner.logoUrl} size={isIpad ? 'xl' : 'md'} />
      <span className={styles.recBody}>
        <span className={styles.recTop}>
          <span className={styles.recName}>{partner.label}</span>
          <CategoryBadge category={partner.category} />
        </span>
        <span className={styles.recDesc}>{partner.description}</span>
      </span>
      <span className={styles.recChevron} aria-hidden>
        ›
      </span>
    </a>
  );
};
