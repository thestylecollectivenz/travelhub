import * as React from 'react';

export interface SecretApiKeyFieldProps {
  label: string;
  hint: string;
  /** True when a key is already saved for this user (value is not shown). */
  hasSavedKey: boolean;
  /** When false, collapse to masked view if a key is saved. */
  panelOpen: boolean;
  /** New key text while editing; never pre-filled from storage. */
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
}

const maskedDisplayStyle: React.CSSProperties = {
  flex: 1,
  border: 'var(--border-default)',
  borderRadius: 'var(--radius-md)',
  padding: 'var(--space-2)',
  fontSize: 'var(--font-size-sm)',
  letterSpacing: '0.12em',
  color: 'var(--color-sand-600)',
  background: 'var(--color-surface)',
  userSelect: 'none',
  WebkitUserSelect: 'none',
  cursor: 'default'
};

const inputStyle: React.CSSProperties = {
  flex: 1,
  border: 'var(--border-default)',
  borderRadius: 'var(--radius-md)',
  padding: 'var(--space-2)'
};

const smallButtonStyle: React.CSSProperties = {
  border: 'var(--border-default)',
  borderRadius: 'var(--radius-md)',
  padding: 'var(--space-2)',
  background: 'var(--color-surface)',
  cursor: 'pointer',
  fontSize: 'var(--font-size-xs)',
  whiteSpace: 'nowrap'
};

function blockClipboard(ev: React.ClipboardEvent): void {
  ev.preventDefault();
}

export const SecretApiKeyField: React.FC<SecretApiKeyFieldProps> = ({
  label,
  hint,
  hasSavedKey,
  panelOpen,
  value,
  onChange,
  placeholder
}) => {
  const [editing, setEditing] = React.useState(!hasSavedKey);

  React.useEffect(() => {
    if (!panelOpen) return;
    setEditing(!hasSavedKey);
  }, [panelOpen, hasSavedKey]);

  const showMasked = hasSavedKey && !editing;

  return (
    <label style={{ display: 'grid', gap: 'var(--space-1)' }}>
      <span style={{ fontSize: 'var(--font-size-sm)', color: 'var(--color-blue-800)' }}>{label}</span>
      <div style={{ display: 'flex', gap: 'var(--space-2)', alignItems: 'center' }}>
        {showMasked ? (
          <div
            role="status"
            aria-label={`${label} saved`}
            style={maskedDisplayStyle}
            onCopy={blockClipboard}
            onCut={blockClipboard}
          >
            ••••••••••••
          </div>
        ) : (
          <input
            type="password"
            autoComplete="off"
            autoCorrect="off"
            spellCheck={false}
            value={value}
            onChange={(e) => onChange(e.target.value)}
            placeholder={placeholder}
            style={inputStyle}
            onCopy={blockClipboard}
            onCut={blockClipboard}
          />
        )}
        {hasSavedKey ? (
          showMasked ? (
            <button type="button" style={smallButtonStyle} onClick={() => setEditing(true)}>
              Change
            </button>
          ) : (
            <button
              type="button"
              style={smallButtonStyle}
              onClick={() => {
                onChange('');
                setEditing(false);
              }}
            >
              Cancel
            </button>
          )
        ) : null}
      </div>
      <span style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-sand-600)' }}>{hint}</span>
    </label>
  );
};
