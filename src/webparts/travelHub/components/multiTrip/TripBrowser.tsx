import * as React from 'react';

export type TripLifecycleStatus = 'Planning' | 'Upcoming' | 'In Progress' | 'Completed' | 'Archived';

export interface MockTripCard {
  id: string;
  title: string;
  dateRangeLabel: string;
  status: TripLifecycleStatus;
}

const MOCK_TRIPS: MockTripCard[] = [
  {
    id: 'mock-trip-1',
    title: 'Summer in Japan',
    dateRangeLabel: '1 Jun 2026 – 14 Jun 2026',
    status: 'Planning'
  },
  {
    id: 'mock-trip-2',
    title: 'South Island road trip',
    dateRangeLabel: '20 Dec 2025 – 5 Jan 2026',
    status: 'Completed'
  }
];

function getStatusBadgeStyles(status: TripLifecycleStatus): React.CSSProperties {
  switch (status) {
    case 'Planning':
      return {
        background: 'var(--color-status-planned-bg)',
        color: 'var(--color-status-planned)'
      };
    case 'Upcoming':
      return {
        background: 'var(--color-status-booked-bg)',
        color: 'var(--color-status-booked)'
      };
    case 'In Progress':
      return {
        background: 'var(--color-status-confirmed-bg)',
        color: 'var(--color-status-confirmed)'
      };
    case 'Completed':
      return {
        background: 'var(--color-status-confirmed-bg)',
        color: 'var(--color-status-confirmed)'
      };
    case 'Archived':
      return {
        background: 'var(--color-status-idea-bg)',
        color: 'var(--color-status-idea)'
      };
  }
}

export interface ITripBrowserProps {
  onSelectTrip: (tripId: string) => void;
}

export const TripBrowser: React.FC<ITripBrowserProps> = ({ onSelectTrip }) => {
  const pageStyle: React.CSSProperties = {
    minHeight: '100%',
    padding: 'var(--space-4)',
    background: 'var(--color-surface)',
    fontFamily: 'var(--font-sans)',
    color: 'var(--color-blue-900)',
    boxSizing: 'border-box'
  };

  const headerRowStyle: React.CSSProperties = {
    display: 'flex',
    flexWrap: 'wrap',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 'var(--space-3)',
    marginBottom: 'var(--space-6)'
  };

  const titleStyle: React.CSSProperties = {
    fontSize: 'var(--font-size-2xl)',
    fontWeight: 'var(--font-weight-bold)',
    color: 'var(--color-blue-800)',
    margin: 0
  };

  const gridStyle: React.CSSProperties = {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fill, minmax(min(100%, 17.5rem), 1fr))',
    gap: 'var(--space-4)'
  };

  const cardStyle: React.CSSProperties = {
    background: 'var(--color-surface-raised)',
    borderRadius: 'var(--radius-lg)',
    boxShadow: 'var(--shadow-card)',
    border: 'var(--border-default)',
    padding: 'var(--space-5)',
    display: 'flex',
    flexDirection: 'column',
    gap: 'var(--space-3)',
    textAlign: 'left'
  };

  const cardTitleStyle: React.CSSProperties = {
    fontSize: 'var(--font-size-lg)',
    fontWeight: 'var(--font-weight-bold)',
    color: 'var(--color-blue-800)',
    margin: 0
  };

  const dateStyle: React.CSSProperties = {
    fontSize: 'var(--font-size-sm)',
    color: 'var(--color-sand-600)'
  };

  const badgeStyleBase: React.CSSProperties = {
    alignSelf: 'flex-start',
    fontSize: 'var(--font-size-xs)',
    fontWeight: 'var(--font-weight-medium)',
    padding: 'var(--space-1) var(--space-3)',
    borderRadius: 'var(--radius-full)'
  };

  const primaryButtonStyle: React.CSSProperties = {
    marginTop: 'auto',
    width: '100%',
    padding: 'var(--space-2) var(--space-4)',
    background: 'var(--color-primary)',
    color: 'var(--color-surface-raised)',
    border: 'none',
    borderRadius: 'var(--radius-md)',
    fontSize: 'var(--font-size-sm)',
    fontWeight: 'var(--font-weight-medium)',
    cursor: 'pointer'
  };

  const secondaryButtonStyle: React.CSSProperties = {
    padding: 'var(--space-2) var(--space-4)',
    background: 'transparent',
    color: 'var(--color-primary)',
    border: 'var(--border-emphasis)',
    borderRadius: 'var(--radius-md)',
    fontSize: 'var(--font-size-sm)',
    fontWeight: 'var(--font-weight-medium)',
    cursor: 'pointer'
  };

  return (
    <div style={pageStyle}>
      <div style={headerRowStyle}>
        <h1 style={titleStyle}>My Trips</h1>
        <button type="button" style={secondaryButtonStyle}>
          Add Trip
        </button>
      </div>

      <div style={gridStyle}>
        {MOCK_TRIPS.map((trip) => (
          <article key={trip.id} style={cardStyle}>
            <h2 style={cardTitleStyle}>{trip.title}</h2>
            <p style={dateStyle}>{trip.dateRangeLabel}</p>
            <span style={{ ...badgeStyleBase, ...getStatusBadgeStyles(trip.status) }}>{trip.status}</span>
            <button type="button" style={primaryButtonStyle} onClick={() => onSelectTrip(trip.id)}>
              Open Trip
            </button>
          </article>
        ))}
      </div>
    </div>
  );
};
