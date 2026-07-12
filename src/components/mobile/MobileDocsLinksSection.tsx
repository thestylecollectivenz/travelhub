import * as React from 'react';
import type { MobileDocLinkItem } from '../../utils/mobileDocLinkItems';
import styles from './MobileDiningDetail.module.css';

export interface MobileDocsLinksSectionProps {
  items: MobileDocLinkItem[];
  emptyHint?: string;
}

export const MobileDocsLinksSection: React.FC<MobileDocsLinksSectionProps> = ({ items, emptyHint }) => {
  if (!items.length) {
    if (!emptyHint) return null;
    return (
      <section className={styles.sectionCard}>
        <div className={styles.sectionHead}>
          <h2 className={styles.sectionTitle}>Documents &amp; links</h2>
        </div>
        <p className={styles.emptyHint}>{emptyHint}</p>
      </section>
    );
  }

  return (
    <section className={styles.sectionCard}>
      <div className={styles.sectionHead}>
        <h2 className={styles.sectionTitle}>Documents &amp; links</h2>
      </div>
      <div className={styles.docLinkRow}>
        {items.map((item) => (
          <a key={item.id} className={styles.docLinkItem} href={item.href} target="_blank" rel="noopener noreferrer">
            {item.kind === 'document' ? (
              <svg width="12" height="12" viewBox="0 0 12 12" fill="none" aria-hidden>
                <rect x="2" y="1.5" width="8" height="9" rx="1" stroke="currentColor" strokeWidth="1" />
              </svg>
            ) : (
              <svg width="12" height="12" viewBox="0 0 12 12" fill="none" aria-hidden>
                <circle cx="6" cy="6" r="4.5" stroke="currentColor" strokeWidth="1" />
              </svg>
            )}
            <span>{item.label}</span>
            {item.kind === 'link' ? (
              <svg width="10" height="10" viewBox="0 0 10 10" fill="none" aria-hidden>
                <path d="M3.5 1.5h5v5M8.5 1.5 1.5 8.5" stroke="currentColor" strokeWidth="1.1" strokeLinecap="round" />
              </svg>
            ) : null}
          </a>
        ))}
      </div>
    </section>
  );
};
