import * as React from 'react';
import * as ReactDom from 'react-dom';
import { useLicence } from '../../../../hooks/useLicence';
import { clearStoredLicenceKey, saveStoredLicenceKey } from '../../../../utils/licenceKeyStorage';

interface LicenceGateProps {
  licenceKey: string;
  /** SharePoint user id (email) — scopes browser storage per user. */
  storageUserId: string;
  onKeySubmit: (key: string) => void;
  children: React.ReactNode;
}

export const LicenceGate: React.FC<LicenceGateProps> = ({ licenceKey, storageUserId, onKeySubmit, children }) => {
  const { isValid, isChecking, message, status } = useLicence(licenceKey);
  const [inputValue, setInputValue] = React.useState('');

  React.useEffect(() => {
    if (!storageUserId || isChecking) return;
    const trimmed = licenceKey.trim();
    if (!trimmed) return;
    if (isValid) {
      saveStoredLicenceKey(storageUserId, trimmed);
    } else if (status === 'invalid') {
      clearStoredLicenceKey(storageUserId);
    }
  }, [storageUserId, licenceKey, isValid, isChecking, status]);

  const [portalRoot, setPortalRoot] = React.useState<HTMLElement | null>(null);

  React.useEffect(() => {
    const portalId = 'th-licence-gate-portal-root';
    let el = document.getElementById(portalId);
    let didCreate = false;
    if (!el) {
      el = document.createElement('div');
      el.id = portalId;
      didCreate = true;
      document.body.appendChild(el);
    }
    setPortalRoot(el);
    return () => {
      // Only remove the node if we created it to avoid collisions with other instances.
      if (didCreate && el?.parentElement) {
        el.parentElement.removeChild(el);
      }
    };
  }, []);

  const gateSurfaceStyle: React.CSSProperties = {
    position: 'fixed',
    inset: 0,
    zIndex: 999999,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    background: 'var(--color-surface)',
    fontFamily: 'var(--font-sans)'
  };

  if (isChecking) {
    const content = (
      <div style={gateSurfaceStyle}>
        <p style={{ color: 'var(--color-blue-600)', fontSize: 'var(--font-size-base)' }}>Checking licence...</p>
      </div>
    );
    return portalRoot ? ReactDom.createPortal(content, portalRoot) : content;
  }

  if (isValid) {
    return <>{children}</>;
  }

  const content = (
    <div style={gateSurfaceStyle}>
      <div style={{ background: 'var(--color-surface-raised)', borderRadius: 'var(--radius-lg)', padding: '40px', maxWidth: '420px', width: '100%', boxShadow: 'var(--shadow-elevated)', textAlign: 'center' }}>
        <h1 style={{ fontSize: 'var(--font-size-xl)', fontWeight: 'var(--font-weight-bold)', color: 'var(--color-blue-800)', marginBottom: '8px' }}>Travel Hub</h1>
        <p style={{ fontSize: 'var(--font-size-sm)', color: 'var(--color-sand-600)', marginBottom: '32px' }}>Enter your licence key to continue</p>
        <input
          type="text"
          placeholder="TRAVELHUB-XXXX-XXXX-XXXX"
          value={inputValue}
          onChange={e => setInputValue(e.target.value)}
          style={{ width: '100%', padding: '10px 14px', fontSize: 'var(--font-size-sm)', border: '1px solid var(--color-sand-200)', borderRadius: 'var(--radius-md)', marginBottom: '12px', outline: 'none' }}
        />
        {message && (
          <p style={{ fontSize: 'var(--font-size-sm)', color: 'var(--color-warning)', marginBottom: '12px' }}>{message}</p>
        )}
        <button
          onClick={() => onKeySubmit(inputValue)}
          style={{ width: '100%', padding: '10px 14px', background: 'var(--color-primary)', color: 'var(--color-surface-raised)', border: 'none', borderRadius: 'var(--radius-md)', fontSize: 'var(--font-size-sm)', fontWeight: 'var(--font-weight-medium)', cursor: 'pointer' }}
        >
          Activate
        </button>
        <p style={{ fontSize: '11px', color: 'var(--color-sand-400)', marginTop: '24px' }}>Need a licence? Visit travelhub.app</p>
      </div>
    </div>
  );

  return portalRoot ? ReactDom.createPortal(content, portalRoot) : content;
};
