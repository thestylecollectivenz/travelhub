import * as React from 'react';
import { useSpContext } from '../../../../context/SpContext';
import { TripService } from '../../../../services/TripService';
import { DayService } from '../../../../services/DayService';
import { TripLifecycleStatus } from '../../../../models';

export interface ICreateTripPanelProps {
  onCreated: (tripId: string) => void;
  onCancel: () => void;
}

const STATUSES: TripLifecycleStatus[] = ['Planning', 'Upcoming', 'In Progress', 'Completed', 'Archived'];

export const CreateTripPanel: React.FC<ICreateTripPanelProps> = ({ onCreated, onCancel }) => {
  const spContext = useSpContext();

  const [title, setTitle] = React.useState('');
  const [destination, setDestination] = React.useState('');
  const [dateStart, setDateStart] = React.useState('');
  const [dateEnd, setDateEnd] = React.useState('');
  const [status, setStatus] = React.useState<TripLifecycleStatus>('Planning');
  const [description, setDescription] = React.useState('');
  const [saving, setSaving] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  // Derived validation
  const dateRangeValid = React.useMemo(() => {
    if (!dateStart || !dateEnd) return true; // not yet filled - no error shown
    return new Date(dateEnd) >= new Date(dateStart);
  }, [dateStart, dateEnd]);

  const canSave =
    title.trim().length > 0 && dateStart.length > 0 && dateEnd.length > 0 && dateRangeValid && !saving;

  const handleSave = async (): Promise<void> => {
    if (!canSave) return;
    setSaving(true);
    setError(null);
    try {
      const tripSvc = new TripService(spContext);
      const daySvc = new DayService(spContext);

      const newTrip = await tripSvc.create({
        title: title.trim(),
        destination: destination.trim(),
        dateStart,
        dateEnd,
        heroImageUrl: '',
        status,
        sharedViewEnabled: false,
        description: description.trim()
      });

      await daySvc.generateDays(newTrip.id, dateStart, dateEnd);

      onCreated(newTrip.id);
    } catch (err) {
      // eslint-disable-next-line no-console
      console.error('CreateTripPanel.handleSave', err);
      setError('Could not create trip. Please try again.');
      setSaving(false);
    }
  };

  // -- Styles -------------------------------------------------------------

  const overlayStyle: React.CSSProperties = {
    position: 'fixed',
    inset: 0,
    background: 'rgba(0,0,0,0.35)',
    zIndex: 1000,
    display: 'flex',
    justifyContent: 'flex-end'
  };

  const panelStyle: React.CSSProperties = {
    width: 'min(100%, 28rem)',
    height: '100%',
    background: 'var(--color-surface-raised)',
    boxShadow: 'var(--shadow-card)',
    display: 'flex',
    flexDirection: 'column',
    fontFamily: 'var(--font-sans)',
    overflowY: 'auto'
  };

  const panelHeaderStyle: React.CSSProperties = {
    padding: 'var(--space-5) var(--space-5) var(--space-4)',
    borderBottom: 'var(--border-default)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 'var(--space-3)'
  };

  const panelTitleStyle: React.CSSProperties = {
    fontSize: 'var(--font-size-lg)',
    fontWeight: 'var(--font-weight-bold)',
    color: 'var(--color-blue-800)',
    margin: 0
  };

  const closeButtonStyle: React.CSSProperties = {
    background: 'none',
    border: 'none',
    cursor: 'pointer',
    padding: 'var(--space-1)',
    color: 'var(--color-sand-600)',
    fontSize: 'var(--font-size-lg)',
    lineHeight: 1
  };

  const bodyStyle: React.CSSProperties = {
    padding: 'var(--space-5)',
    display: 'flex',
    flexDirection: 'column',
    gap: 'var(--space-5)',
    flex: 1
  };

  const fieldGroupStyle: React.CSSProperties = {
    display: 'flex',
    flexDirection: 'column',
    gap: 'var(--space-1)'
  };

  const labelStyle: React.CSSProperties = {
    fontSize: 'var(--font-size-sm)',
    fontWeight: 'var(--font-weight-medium)',
    color: 'var(--color-blue-700)'
  };

  const requiredMarkStyle: React.CSSProperties = {
    color: 'var(--color-warning)',
    marginLeft: 'var(--space-1)'
  };

  const inputStyle: React.CSSProperties = {
    padding: 'var(--space-2) var(--space-3)',
    border: 'var(--border-default)',
    borderRadius: 'var(--radius-md)',
    fontSize: 'var(--font-size-sm)',
    fontFamily: 'var(--font-sans)',
    color: 'var(--color-blue-900)',
    background: 'var(--color-surface)',
    width: '100%',
    boxSizing: 'border-box'
  };

  const textareaStyle: React.CSSProperties = {
    ...inputStyle,
    resize: 'vertical',
    minHeight: '5rem'
  };

  const selectStyle: React.CSSProperties = {
    ...inputStyle,
    cursor: 'pointer'
  };

  const dateRowStyle: React.CSSProperties = {
    display: 'grid',
    gridTemplateColumns: '1fr 1fr',
    gap: 'var(--space-3)'
  };

  const errorStyle: React.CSSProperties = {
    fontSize: 'var(--font-size-sm)',
    color: 'var(--color-warning)',
    padding: 'var(--space-2) var(--space-3)',
    background: 'var(--color-status-idea-bg)',
    borderRadius: 'var(--radius-md)'
  };

  const hintStyle: React.CSSProperties = {
    fontSize: 'var(--font-size-xs)',
    color: 'var(--color-sand-600)'
  };

  const footerStyle: React.CSSProperties = {
    padding: 'var(--space-4) var(--space-5)',
    borderTop: 'var(--border-default)',
    display: 'flex',
    gap: 'var(--space-3)',
    justifyContent: 'flex-end'
  };

  const primaryButtonStyle: React.CSSProperties = {
    padding: 'var(--space-2) var(--space-5)',
    background: canSave ? 'var(--color-primary)' : 'var(--color-sand-300)',
    color: canSave ? 'var(--color-surface-raised)' : 'var(--color-sand-600)',
    border: 'none',
    borderRadius: 'var(--radius-md)',
    fontSize: 'var(--font-size-sm)',
    fontWeight: 'var(--font-weight-medium)',
    cursor: canSave ? 'pointer' : 'not-allowed'
  };

  const cancelButtonStyle: React.CSSProperties = {
    padding: 'var(--space-2) var(--space-5)',
    background: 'transparent',
    color: 'var(--color-blue-700)',
    border: 'var(--border-default)',
    borderRadius: 'var(--radius-md)',
    fontSize: 'var(--font-size-sm)',
    fontWeight: 'var(--font-weight-medium)',
    cursor: 'pointer'
  };

  // -- Render --------------------------------------------------------------

  return (
    <div
      style={overlayStyle}
      onClick={(e) => {
        if (e.target === e.currentTarget) onCancel();
      }}
    >
      <div style={panelStyle} role="dialog" aria-modal="true" aria-label="Create trip">
        <div style={panelHeaderStyle}>
          <h2 style={panelTitleStyle}>New Trip</h2>
          <button type="button" style={closeButtonStyle} onClick={onCancel} aria-label="Close panel">
            ✕
          </button>
        </div>

        <div style={bodyStyle}>
          {error && <div style={errorStyle}>{error}</div>}

          <div style={fieldGroupStyle}>
            <label style={labelStyle}>
              Trip title <span style={requiredMarkStyle}>*</span>
            </label>
            <input
              type="text"
              style={inputStyle}
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="e.g. Japan 2026"
              maxLength={255}
              disabled={saving}
            />
          </div>

          <div style={fieldGroupStyle}>
            <label style={labelStyle}>Destination</label>
            <input
              type="text"
              style={inputStyle}
              value={destination}
              onChange={(e) => setDestination(e.target.value)}
              placeholder="e.g. Tokyo, Japan"
              maxLength={255}
              disabled={saving}
            />
          </div>

          <div style={fieldGroupStyle}>
            <label style={labelStyle}>
              Date range <span style={requiredMarkStyle}>*</span>
            </label>
            <div style={dateRowStyle}>
              <div style={fieldGroupStyle}>
                <label style={hintStyle}>Start</label>
                <input
                  type="date"
                  style={inputStyle}
                  value={dateStart}
                  onChange={(e) => setDateStart(e.target.value)}
                  disabled={saving}
                />
              </div>
              <div style={fieldGroupStyle}>
                <label style={hintStyle}>End</label>
                <input
                  type="date"
                  style={inputStyle}
                  value={dateEnd}
                  min={dateStart || undefined}
                  onChange={(e) => setDateEnd(e.target.value)}
                  disabled={saving}
                />
              </div>
            </div>
            {!dateRangeValid && (
              <span style={{ ...hintStyle, color: 'var(--color-warning)' }}>
                End date must be on or after start date.
              </span>
            )}
          </div>

          <div style={fieldGroupStyle}>
            <label style={labelStyle}>Status</label>
            <select
              style={selectStyle}
              value={status}
              onChange={(e) => setStatus(e.target.value as TripLifecycleStatus)}
              disabled={saving}
            >
              {STATUSES.map((s) => (
                <option key={s} value={s}>
                  {s}
                </option>
              ))}
            </select>
          </div>

          <div style={fieldGroupStyle}>
            <label style={labelStyle}>Description</label>
            <textarea
              style={textareaStyle}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Optional short trip blurb"
              disabled={saving}
            />
          </div>

          <div style={fieldGroupStyle}>
            <label style={labelStyle}>Hero image</label>
            <p style={hintStyle}>
              Hero image upload will be available in a later update. You can add a URL directly to the trip after
              creation.
            </p>
          </div>
        </div>

        <div style={footerStyle}>
          <button type="button" style={cancelButtonStyle} onClick={onCancel} disabled={saving}>
            Cancel
          </button>
          <button
            type="button"
            style={primaryButtonStyle}
            onClick={() => {
              handleSave().catch(console.error);
            }}
            disabled={!canSave}
          >
            {saving ? 'Creating…' : 'Create Trip'}
          </button>
        </div>
      </div>
    </div>
  );
};
