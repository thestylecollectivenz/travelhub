import * as React from 'react';
import type { Trip, TripLifecycleStatus } from '../../models/Trip';

export interface EditTripPanelProps {
  trip: Trip;
  isOpen: boolean;
  onClose: () => void;
  onSave: (partial: Partial<Trip>) => void;
}

const STATUSES: TripLifecycleStatus[] = ['Planning', 'Upcoming', 'In Progress', 'Completed', 'Archived'];

export const EditTripPanel: React.FC<EditTripPanelProps> = ({ trip, isOpen, onClose, onSave }) => {
  const [draft, setDraft] = React.useState<Trip>(trip);

  React.useEffect(() => {
    if (isOpen) {
      setDraft(trip);
    }
  }, [isOpen, trip]);

  if (!isOpen) {
    return null;
  }

  const dateRangeValid = !draft.dateStart || !draft.dateEnd || new Date(draft.dateEnd) >= new Date(draft.dateStart);
  const canSave = draft.title.trim().length > 0 && draft.dateStart.length > 0 && draft.dateEnd.length > 0 && dateRangeValid;

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        background: 'rgba(0, 0, 0, 0.35)',
        zIndex: 1200,
        display: 'flex',
        justifyContent: 'flex-end'
      }}
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <aside
        style={{
          width: 'min(100%, 30rem)',
          height: '100%',
          background: 'var(--color-surface-raised)',
          boxShadow: 'var(--shadow-card)',
          display: 'flex',
          flexDirection: 'column',
          overflowY: 'auto'
        }}
        role="dialog"
        aria-modal="true"
        aria-label="Edit trip details"
      >
        <div
          style={{
            padding: 'var(--space-5)',
            borderBottom: 'var(--border-default)',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center'
          }}
        >
          <h2 style={{ margin: 0, color: 'var(--color-blue-800)', fontSize: 'var(--font-size-lg)' }}>Edit trip details</h2>
          <button type="button" onClick={onClose} aria-label="Close panel" style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 'var(--font-size-lg)' }}>
            ✕
          </button>
        </div>

        <div style={{ padding: 'var(--space-5)', display: 'grid', gap: 'var(--space-4)' }}>
          <label style={{ display: 'grid', gap: 'var(--space-1)' }}>
            <span style={{ fontSize: 'var(--font-size-sm)', color: 'var(--color-blue-700)' }}>Trip title</span>
            <input
              type="text"
              value={draft.title}
              onChange={(e) => setDraft((prev) => ({ ...prev, title: e.target.value }))}
              maxLength={255}
              style={{ padding: 'var(--space-2) var(--space-3)', border: 'var(--border-default)', borderRadius: 'var(--radius-md)' }}
            />
          </label>

          <label style={{ display: 'grid', gap: 'var(--space-1)' }}>
            <span style={{ fontSize: 'var(--font-size-sm)', color: 'var(--color-blue-700)' }}>Destination</span>
            <input
              type="text"
              value={draft.destination}
              onChange={(e) => setDraft((prev) => ({ ...prev, destination: e.target.value }))}
              maxLength={255}
              style={{ padding: 'var(--space-2) var(--space-3)', border: 'var(--border-default)', borderRadius: 'var(--radius-md)' }}
            />
          </label>

          <div style={{ display: 'grid', gap: 'var(--space-2)' }}>
            <span style={{ fontSize: 'var(--font-size-sm)', color: 'var(--color-blue-700)' }}>Date range</span>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'var(--space-3)' }}>
              <input
                type="date"
                value={draft.dateStart}
                onChange={(e) => setDraft((prev) => ({ ...prev, dateStart: e.target.value }))}
                style={{ padding: 'var(--space-2) var(--space-3)', border: 'var(--border-default)', borderRadius: 'var(--radius-md)' }}
              />
              <input
                type="date"
                value={draft.dateEnd}
                min={draft.dateStart || undefined}
                onChange={(e) => setDraft((prev) => ({ ...prev, dateEnd: e.target.value }))}
                style={{ padding: 'var(--space-2) var(--space-3)', border: 'var(--border-default)', borderRadius: 'var(--radius-md)' }}
              />
            </div>
            {!dateRangeValid ? (
              <span style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-warning)' }}>
                End date must be on or after start date.
              </span>
            ) : null}
            <span style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-sand-600)' }}>
              Changing dates does not add or remove days. Use day management to adjust the itinerary structure.
            </span>
          </div>

          <label style={{ display: 'grid', gap: 'var(--space-1)' }}>
            <span style={{ fontSize: 'var(--font-size-sm)', color: 'var(--color-blue-700)' }}>Status</span>
            <select
              value={draft.status}
              onChange={(e) => setDraft((prev) => ({ ...prev, status: e.target.value as TripLifecycleStatus }))}
              style={{ padding: 'var(--space-2) var(--space-3)', border: 'var(--border-default)', borderRadius: 'var(--radius-md)' }}
            >
              {STATUSES.map((s) => (
                <option key={s} value={s}>
                  {s}
                </option>
              ))}
            </select>
          </label>

          <label style={{ display: 'grid', gap: 'var(--space-1)' }}>
            <span style={{ fontSize: 'var(--font-size-sm)', color: 'var(--color-blue-700)' }}>Description</span>
            <textarea
              value={draft.description ?? ''}
              onChange={(e) => setDraft((prev) => ({ ...prev, description: e.target.value }))}
              style={{ minHeight: '5rem', padding: 'var(--space-2) var(--space-3)', border: 'var(--border-default)', borderRadius: 'var(--radius-md)' }}
            />
          </label>

          <label style={{ display: 'grid', gap: 'var(--space-1)' }}>
            <span style={{ fontSize: 'var(--font-size-sm)', color: 'var(--color-blue-700)' }}>Hero image URL</span>
            <input
              type="url"
              value={draft.heroImageUrl}
              onChange={(e) => setDraft((prev) => ({ ...prev, heroImageUrl: e.target.value }))}
              placeholder="https://..."
              style={{ padding: 'var(--space-2) var(--space-3)', border: 'var(--border-default)', borderRadius: 'var(--radius-md)' }}
            />
          </label>
        </div>

        <div style={{ marginTop: 'auto', padding: 'var(--space-4) var(--space-5)', borderTop: 'var(--border-default)', display: 'flex', justifyContent: 'flex-end', gap: 'var(--space-3)' }}>
          <button type="button" onClick={onClose} style={{ padding: 'var(--space-2) var(--space-4)', background: 'transparent', border: 'var(--border-default)', borderRadius: 'var(--radius-md)', cursor: 'pointer' }}>
            Cancel
          </button>
          <button
            type="button"
            disabled={!canSave}
            onClick={() => {
              onSave({
                title: draft.title.trim(),
                destination: draft.destination.trim(),
                dateStart: draft.dateStart,
                dateEnd: draft.dateEnd,
                status: draft.status,
                description: (draft.description ?? '').trim(),
                heroImageUrl: draft.heroImageUrl.trim()
              });
              onClose();
            }}
            style={{
              padding: 'var(--space-2) var(--space-4)',
              border: 'none',
              borderRadius: 'var(--radius-md)',
              background: canSave ? 'var(--color-primary)' : 'var(--color-sand-300)',
              color: canSave ? 'var(--color-surface-raised)' : 'var(--color-sand-600)',
              cursor: canSave ? 'pointer' : 'not-allowed'
            }}
          >
            Save changes
          </button>
        </div>
      </aside>
    </div>
  );
};
