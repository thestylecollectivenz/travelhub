import * as React from 'react';

export interface TermsAndConditionsProps {
  onBack: () => void;
}

export const TermsAndConditions: React.FC<TermsAndConditionsProps> = ({ onBack }) => {
  return (
    <div style={{ padding: 'var(--space-6)', maxWidth: 900, margin: '0 auto', fontFamily: 'var(--font-sans)' }}>
      <button type="button" onClick={onBack} style={{ marginBottom: 'var(--space-4)' }}>← Back</button>
      <h1>Travel Hub Terms and Conditions</h1>
      <p>Travel Hub is provided as-is for personal trip planning and collaboration.</p>
      <h2>Data and Privacy</h2>
      <p>You are responsible for content you upload, including documents, links, and journal media. Share links only with people you trust.</p>
      <h2>Usage</h2>
      <p>Do not upload unlawful or harmful content. Use of external APIs (maps/weather) is subject to their own terms.</p>
      <h2>Availability</h2>
      <p>Features may change over time. Back up critical travel information before departure.</p>
      <h2>Liability</h2>
      <p>Travel Hub provides planning support only and does not guarantee booking accuracy, route safety, or third-party service availability.</p>
      <p style={{ marginTop: 'var(--space-4)', color: 'var(--color-sand-600)' }}>Last updated: 2026-04-27</p>
    </div>
  );
};
