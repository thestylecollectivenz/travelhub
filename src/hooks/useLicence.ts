import { useState, useEffect } from 'react';
import { LicenceService, LicenceStatus } from '../services/LicenceService';

export interface UseLicenceResult {
  status: LicenceStatus;
  isValid: boolean;
  isChecking: boolean;
  message?: string;
  recheck: (key: string) => Promise<void>;
}

export function useLicence(licenceKey: string): UseLicenceResult {
  const [status, setStatus] = useState<LicenceStatus>('unchecked');
  const [isChecking, setIsChecking] = useState(false);
  const [message, setMessage] = useState<string | undefined>();
  const [hasValidated, setHasValidated] = useState(false);

  const check = async (key: string, forceSpinner?: boolean): Promise<void> => {
    const trimmed = (key || '').trim();
    const showSpinner = Boolean(forceSpinner) || !hasValidated;
    if (showSpinner) setIsChecking(true);
    try {
      const result = await LicenceService.validate(trimmed);
      setStatus(result.status);
      setMessage(result.message);
      if (result.status === 'valid' || result.status === 'personal') {
        setHasValidated(true);
      }
    } finally {
      if (showSpinner) setIsChecking(false);
    }
  };

  useEffect(() => {
    if (!licenceKey) return;
    void check(licenceKey);
    // Intentionally only re-run when the key changes.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [licenceKey]);

  return {
    status,
    isValid: status === 'valid' || status === 'personal',
    isChecking,
    message,
    recheck: (key: string) => check(key, true)
  };
}
