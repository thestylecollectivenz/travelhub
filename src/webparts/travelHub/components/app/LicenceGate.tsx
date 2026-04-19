import * as React from 'react';
import { useLicence } from '../../../../hooks/useLicence';

interface LicenceGateProps {
  licenceKey: string;
  onKeySubmit: (key: string) => void;
  children: React.ReactNode;
}

export const LicenceGate: React.FC<LicenceGateProps> = ({ licenceKey, onKeySubmit, children }) => {
  const { isValid, isChecking, message } = useLicence(licenceKey);
  const [inputValue, setInputValue] = React.useState('');

  if (isChecking) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100vh', fontFamily: 'var(--font-sans)' }}>
        <p style={{ color: 'var(--color-blue-600)', fontSize: 'var(--font-size-base)' }}>Checking licence...</p>
      </div>
    );
  }

  if (isValid) {
    return <>{children}</>;
  }

  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100vh', background: 'var(--color-surface)', fontFamily: 'var(--font-sans)' }}>
      <div style={{ background: 'white', borderRadius: 'var(--radius-lg)', padding: '40px', maxWidth: '420px', width: '100%', boxShadow: 'var(--shadow-elevated)', textAlign: 'center' }}>
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
          style={{ width: '100%', padding: '10px 14px', background: 'var(--color-primary)', color: 'white', border: 'none', borderRadius: 'var(--radius-md)', fontSize: 'var(--font-size-sm)', fontWeight: 'var(--font-weight-medium)', cursor: 'pointer' }}
        >
          Activate
        </button>
        <p style={{ fontSize: '11px', color: 'var(--color-sand-400)', marginTop: '24px' }}>Need a licence? Visit travelhub.app</p>
      </div>
    </div>
  );
};
