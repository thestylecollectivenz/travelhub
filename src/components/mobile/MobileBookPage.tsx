import * as React from 'react';
import { useAppConfig } from '../../context/AppConfigContext';
import { useCanManageSiteConfig } from '../../hooks/useCanManageSiteConfig';
import { useShellMode } from '../../hooks/useShellMode';
import {
  BOOKING_AFFILIATES_CONFIG_KEY,
  groupBookingPartnersByCategory,
  moreBookingPartners,
  recommendedBookingPartners,
  resolveBookingAffiliatePartners
} from '../../utils/bookingAffiliateLinks';
import { BookingAffiliateSettingsPanel } from '../workspace/BookingAffiliateSettingsPanel';
import { BookingPartnerCard } from './BookingPartnerCard';
import styles from './MobileBookPage.module.css';

export interface MobileBookPageProps {
  destinationHint?: string;
  showTitle?: boolean;
  onViewAllPartners?: (destination: string) => void;
  onViewTripOverview?: () => void;
}

type BookFilter = 'all' | 'category';

async function resolveNearMePlace(): Promise<string> {
  if (!navigator.geolocation) throw new Error('Geolocation unavailable');
  const pos = await new Promise<GeolocationPosition>((resolve, reject) => {
    navigator.geolocation.getCurrentPosition(resolve, reject, { timeout: 12000, maximumAge: 600000 });
  });
  const lat = pos.coords.latitude;
  const lon = pos.coords.longitude;
  const url = `https://nominatim.openstreetmap.org/reverse?lat=${lat}&lon=${lon}&format=json`;
  const resp = await fetch(url, { headers: { Accept: 'application/json' } });
  if (!resp.ok) throw new Error('Could not resolve location');
  const data = (await resp.json()) as {
    address?: { city?: string; town?: string; village?: string; state?: string; country?: string };
  };
  const a = data.address;
  return a?.city || a?.town || a?.village || a?.state || a?.country || 'near me';
}

export const MobileBookPage: React.FC<MobileBookPageProps> = ({
  destinationHint = '',
  showTitle = true,
  onViewAllPartners,
  onViewTripOverview
}) => {
  const { appConfig } = useAppConfig();
  const canManageSite = useCanManageSiteConfig();
  const shellMode = useShellMode();
  const [query, setQuery] = React.useState(destinationHint);
  const [filter, setFilter] = React.useState<BookFilter>('all');
  const [nearBusy, setNearBusy] = React.useState(false);
  const [affiliateSettingsOpen, setAffiliateSettingsOpen] = React.useState(false);

  const overridesJson = appConfig.get(BOOKING_AFFILIATES_CONFIG_KEY);

  React.useEffect(() => {
    if (destinationHint) setQuery(destinationHint);
  }, [destinationHint]);

  const partners = React.useMemo(
    () => resolveBookingAffiliatePartners(query, overridesJson),
    [query, overridesJson]
  );
  const recommended = React.useMemo(() => recommendedBookingPartners(partners), [partners]);
  const more = React.useMemo(() => moreBookingPartners(partners), [partners]);
  const grouped = React.useMemo(() => groupBookingPartnersByCategory(partners), [partners]);

  const useNearMe = (): void => {
    setNearBusy(true);
    void resolveNearMePlace()
      .then((place) => setQuery(place))
      .catch(() => setQuery('near me'))
      .finally(() => setNearBusy(false));
  };

  return (
    <div className={styles.root} data-shell={shellMode === 'ipad-portrait' ? 'ipad-portrait' : undefined}>
      {showTitle ? <h2 className={styles.title}>Book</h2> : null}
      {showTitle ? <p className={styles.sub}>Search partner sites for stays, flights, tours, and more.</p> : null}

      {canManageSite ? (
        <div className={styles.adminRow}>
          <button type="button" className={styles.adminLink} onClick={() => setAffiliateSettingsOpen(true)}>
            Manage affiliate partners
          </button>
        </div>
      ) : null}

      <div className={styles.searchRow}>
        <label className={styles.searchLabel}>
          Booking for (optional)
          <div className={styles.searchWrap}>
            <input
              className={styles.searchInput}
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Select or type a city, country, or place"
              aria-label="Booking destination"
            />
            <span className={styles.searchIcon} aria-hidden>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
                <circle cx="11" cy="11" r="6.5" stroke="currentColor" strokeWidth="1.8" />
                <path d="M16 16l5 5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
              </svg>
            </span>
          </div>
        </label>
        <button type="button" className={styles.nearBtn} onClick={useNearMe} disabled={nearBusy}>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" aria-hidden>
            <path d="M12 21s6.5-5.2 6.5-10.2A6.5 6.5 0 0 0 12 4.3a6.5 6.5 0 0 0-6.5 6.5C5.5 15.8 12 21 12 21Z" stroke="currentColor" strokeWidth="1.6" />
            <circle cx="12" cy="10.8" r="2" stroke="currentColor" strokeWidth="1.6" />
          </svg>
          {nearBusy ? 'Locating…' : 'Near me'}
        </button>
      </div>

      <div className={styles.filterRow} role="tablist" aria-label="Partner view">
        <button
          type="button"
          role="tab"
          aria-selected={filter === 'all'}
          className={`${styles.filterChip} ${filter === 'all' ? styles.filterChipOn : ''}`}
          onClick={() => setFilter('all')}
        >
          All partners
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={filter === 'category'}
          className={`${styles.filterChip} ${filter === 'category' ? styles.filterChipOn : ''}`}
          onClick={() => setFilter('category')}
        >
          By category
        </button>
      </div>

      {filter === 'all' ? (
        <>
          <section className={styles.section}>
            <div className={styles.sectionHead}>
              <h3 className={styles.sectionTitle}>
                <span className={styles.star} aria-hidden>
                  ★
                </span>{' '}
                Recommended for this trip
              </h3>
              <p className={styles.sectionSub}>Our top partners to help you plan and book with confidence.</p>
            </div>
            <div className={styles.recGrid}>
              {recommended.map((p) => (
                <BookingPartnerCard key={p.id} partner={p} variant="recommended" />
              ))}
            </div>
          </section>

          {more.length ? (
            <section className={styles.section}>
              <div className={styles.sectionHeadRow}>
                <div>
                  <h3 className={styles.sectionTitlePlain}>More partners</h3>
                  <p className={styles.sectionSub}>Explore more ways to book your trip.</p>
                </div>
                {onViewAllPartners ? (
                  <button type="button" className={styles.viewAllLink} onClick={() => onViewAllPartners(query)}>
                    View all
                  </button>
                ) : null}
              </div>
              <div className={styles.moreRow}>
                {more.map((p) => (
                  <BookingPartnerCard key={p.id} partner={p} variant="compact" />
                ))}
              </div>
            </section>
          ) : null}
        </>
      ) : (
        grouped.map((group) => (
          <section key={group.category} className={styles.section}>
            <h3 className={styles.sectionTitlePlain}>{group.label}</h3>
            <div className={styles.recGrid}>
              {group.items.map((p) => (
                <BookingPartnerCard key={p.id} partner={p} variant="recommended" />
              ))}
            </div>
          </section>
        ))
      )}

      <section className={styles.footerBanner}>
        <div className={styles.footerArt} aria-hidden>
          <svg width="72" height="56" viewBox="0 0 72 56" fill="none">
            <rect x="18" y="14" width="28" height="34" rx="6" fill="#6b7c3a" opacity="0.85" />
            <path d="M26 14v-4h12v4" stroke="#55632e" strokeWidth="2" />
            <rect x="42" y="22" width="18" height="14" rx="3" fill="#c4a574" />
            <circle cx="48" cy="29" r="3" fill="#8a7355" />
          </svg>
        </div>
        <div className={styles.footerCopy}>
          <h3 className={styles.footerTitle}>Plan it. Book it. Enjoy it.</h3>
          <p className={styles.footerSub}>Compare options, book with confidence and make the most of your trip.</p>
          {onViewTripOverview ? (
            <button type="button" className={styles.footerBtn} onClick={onViewTripOverview}>
              View trip overview
              <span aria-hidden> →</span>
            </button>
          ) : null}
        </div>
      </section>

      {affiliateSettingsOpen ? (
        <BookingAffiliateSettingsPanel onClose={() => setAffiliateSettingsOpen(false)} />
      ) : null}
    </div>
  );
};
