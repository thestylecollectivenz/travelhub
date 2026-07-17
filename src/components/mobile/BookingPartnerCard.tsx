import * as React from 'react';
import {
  bookingAffiliateCategoryLabel,
  type BookingAffiliateCategory,
  type ResolvedBookingAffiliatePartner
} from '../../utils/bookingAffiliateLinks';
import { openMobileExternalUrl } from '../../hooks/useMobileDetailHistory';
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

function PartnerLink(props: {
  className: string;
  href: string;
  children: React.ReactNode;
}): React.ReactElement {
  return (
    <a
      className={props.className}
      href={props.href}
      target="_blank"
      rel="noopener noreferrer"
      onClick={(e) => openMobileExternalUrl(props.href, e)}
    >
      {props.children}
    </a>
  );
}

export const BookingPartnerCard: React.FC<BookingPartnerCardProps> = ({ partner, variant = 'recommended' }) => {
  if (variant === 'compact') {
    return (
      <PartnerLink className={styles.moreCard} href={partner.href}>
        <BookingPartnerLogo label={partner.label} logoUrl={partner.logoUrl} size="sm" />
        <span className={styles.moreName}>{partner.label}</span>
        <CategoryBadge category={partner.category} />
      </PartnerLink>
    );
  }

  if (variant === 'grid') {
    return (
      <PartnerLink className={styles.gridCard} href={partner.href}>
        <BookingPartnerLogo label={partner.label} logoUrl={partner.logoUrl} size="sm" />
        <span className={styles.gridName}>{partner.label}</span>
        <CategoryBadge category={partner.category} />
      </PartnerLink>
    );
  }

  return (
    <PartnerLink className={styles.recCard} href={partner.href}>
      <BookingPartnerLogo label={partner.label} logoUrl={partner.logoUrl} size="md" />
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
    </PartnerLink>
  );
};
