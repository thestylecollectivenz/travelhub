import * as React from 'react';
import {
  groupBookingAffiliateLinks,
  homeBookingAffiliateLinks
} from '../../utils/bookingAffiliateLinks';
import styles from './MobileBookPage.module.css';

export interface MobileBookPageProps {
  destinationHint?: string;
  showTitle?: boolean;
}

export const MobileBookPage: React.FC<MobileBookPageProps> = ({ destinationHint = '', showTitle = true }) => {
  const [query, setQuery] = React.useState(destinationHint);
  const groups = React.useMemo(
    () => groupBookingAffiliateLinks(homeBookingAffiliateLinks(query)),
    [query]
  );

  return (
    <div className={styles.root}>
      {showTitle ? <h2 className={styles.title}>Book</h2> : null}
      {showTitle ? <p className={styles.sub}>Search partner sites for stays, flights, tours, and more.</p> : null}
      <label className={styles.searchLabel}>
        Destination or trip name
        <input
          className={styles.searchInput}
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="e.g. Paris, Queenstown…"
        />
      </label>
      {groups.map((group) => (
        <section key={group.category} className={styles.group}>
          <h3 className={styles.groupTitle}>{group.label}</h3>
          <div className={styles.list}>
            {group.items.map((item) => (
              <a
                key={item.id}
                className={styles.card}
                href={item.href}
                target="_blank"
                rel="noopener noreferrer"
              >
                <span className={styles.cardLabel}>{item.label}</span>
                <span className={styles.cardDesc}>{item.description}</span>
              </a>
            ))}
          </div>
        </section>
      ))}
    </div>
  );
};
