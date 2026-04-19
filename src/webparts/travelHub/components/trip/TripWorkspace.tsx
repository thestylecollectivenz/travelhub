import * as React from 'react';

export interface ITripWorkspaceProps {
  tripId: string;
  onBack: () => void;
}

export const TripWorkspace: React.FC<ITripWorkspaceProps> = ({ tripId, onBack }) => {
  const shellStyle: React.CSSProperties = {
    minHeight: '100%',
    padding: 'var(--space-4)',
    background: 'var(--color-surface)',
    fontFamily: 'var(--font-sans)',
    color: 'var(--color-blue-900)',
    boxSizing: 'border-box'
  };

  const headerStyle: React.CSSProperties = {
    marginBottom: 'var(--space-6)'
  };

  const backButtonStyle: React.CSSProperties = {
    display: 'inline-flex',
    alignItems: 'center',
    gap: 'var(--space-2)',
    padding: 'var(--space-2) var(--space-3)',
    marginBottom: 'var(--space-4)',
    background: 'transparent',
    border: 'var(--border-default)',
    borderRadius: 'var(--radius-md)',
    fontSize: 'var(--font-size-sm)',
    fontWeight: 'var(--font-weight-medium)',
    color: 'var(--color-primary)',
    cursor: 'pointer'
  };

  const titleStyle: React.CSSProperties = {
    fontSize: 'var(--font-size-2xl)',
    fontWeight: 'var(--font-weight-bold)',
    color: 'var(--color-blue-800)',
    margin: 0
  };

  const placeholderStyle: React.CSSProperties = {
    marginTop: 'var(--space-6)',
    padding: 'var(--space-8)',
    borderRadius: 'var(--radius-lg)',
    border: 'var(--border-default)',
    background: 'var(--color-surface-raised)',
    boxShadow: 'var(--shadow-card)',
    fontSize: 'var(--font-size-md)',
    color: 'var(--color-sand-600)',
    textAlign: 'center'
  };

  return (
    <div style={shellStyle}>
      <header style={headerStyle}>
        <button type="button" style={backButtonStyle} onClick={onBack}>
          ← All Trips
        </button>
        <h1 style={titleStyle}>Loading...</h1>
      </header>
      <main style={placeholderStyle} data-trip-id={tripId}>
        Trip workspace coming soon
      </main>
    </div>
  );
};
