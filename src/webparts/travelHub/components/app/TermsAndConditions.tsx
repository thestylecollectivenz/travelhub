import * as React from 'react';
import styles from './TermsAndConditions.module.css';

export interface TermsAndConditionsProps {
  onBack: () => void;
}

export const TermsAndConditions: React.FC<TermsAndConditionsProps> = ({ onBack }) => {
  return (
    <div className={styles.page}>
      <section className={styles.card}>
        <button type="button" onClick={onBack} className={styles.backLink}>← Back</button>
        <h1 className={styles.title}>Travel Hub Terms and Conditions</h1>
        <p className={styles.body}>Travel Hub is provided as-is for personal trip planning and collaboration.</p>
        <h2 className={styles.sectionTitle}>Data and Privacy</h2>
        <p className={styles.body}>You are responsible for content you upload, including documents, links, and journal media. Share links only with people you trust.</p>
        <h2 className={styles.sectionTitle}>Usage</h2>
        <p className={styles.body}>Do not upload unlawful or harmful content. Use of external APIs (maps/weather) is subject to their own terms.</p>
        <h2 className={styles.sectionTitle}>Availability</h2>
        <p className={styles.body}>Features may change over time. Back up critical travel information before departure.</p>
        <h2 className={styles.sectionTitle}>Liability</h2>
        <p className={styles.body}>Travel Hub provides planning support only and does not guarantee booking accuracy, route safety, or third-party service availability.</p>
        <p className={styles.muted}>Last updated: 2026-04-27</p>
      </section>
    </div>
  );
};
