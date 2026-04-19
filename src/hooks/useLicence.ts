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

  const check = async (key: string): Promise<void> => {
    setIsChecking(true);
    const result = await LicenceService.validate(key);
    setStatus(result.status);
    setMessage(result.message);
    setIsChecking(false);
  };

  useEffect(() => {
    if (licenceKey) {
      void check(licenceKey);
    }
  }, [licenceKey]);

  return {
    status,
    isValid: status === 'valid' || status === 'personal',
    isChecking,
    message,
    recheck: check
  };
}
