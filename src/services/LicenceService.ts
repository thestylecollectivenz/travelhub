export type LicenceStatus = 'valid' | 'invalid' | 'unchecked' | 'personal';

export interface LicenceResult {
  status: LicenceStatus;
  message?: string;
}

const PERSONAL_KEY = 'TRAVELHUB-PERSONAL-TSC-2026';
const VALIDATION_ENDPOINT = 'https://licence.travelhub.app/validate';

export class LicenceService {
  static async validate(key: string): Promise<LicenceResult> {
    if (!key || key.trim() === '') {
      return { status: 'invalid', message: 'No licence key provided.' };
    }
    if (key.trim() === PERSONAL_KEY) {
      return { status: 'personal' };
    }
    try {
      const response = await fetch(VALIDATION_ENDPOINT, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ key: key.trim() })
      });
      if (!response.ok) {
        return { status: 'invalid', message: 'Licence validation failed. Please check your key.' };
      }
      const data = await response.json();
      if (data.valid === true) {
        return { status: 'valid' };
      }
      return { status: 'invalid', message: data.message || 'Invalid licence key.' };
    } catch {
      return { status: 'invalid', message: 'Could not reach licence server. Please check your connection.' };
    }
  }
}
