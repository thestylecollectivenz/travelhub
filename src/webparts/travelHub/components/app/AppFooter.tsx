import * as React from 'react';

export interface AppFooterProps {
  onOpenTerms: () => void;
}

export const AppFooter: React.FC<AppFooterProps> = ({ onOpenTerms }) => {
  return (
    <footer style={{ borderTop: 'var(--border-default)', padding: 'var(--space-2) var(--space-4)', background: 'var(--color-surface-raised)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: 'var(--font-size-xs)' }}>
      <span>Travel Hub</span>
      <button type="button" onClick={onOpenTerms} style={{ border: 'none', background: 'transparent', color: 'var(--color-primary)', cursor: 'pointer', textDecoration: 'underline' }}>
        Terms and Conditions
      </button>
    </footer>
  );
};
