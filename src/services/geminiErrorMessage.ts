import { GeminiServiceError } from './GeminiService';

/** Short, user-facing message for UI (not raw API JSON). */
export function formatGeminiUserMessage(err: unknown): string {
  if (err instanceof GeminiServiceError) {
    if (err.code === 'NO_KEY') {
      return 'Add a Gemini API key in User settings.';
    }
    const raw = err.message;
    const lower = raw.toLowerCase();
    if (
      lower.includes('quota') ||
      lower.includes('resource_exhausted') ||
      lower.includes('free_tier') ||
      err.status === 429
    ) {
      return (
        'Gemini rejected the request due to quota limits. Google offers a free tier with daily caps per account/project, ' +
        'but your key may show limit 0 in AI Studio (billing, new project, or rate-limit tier). ' +
        'Open aistudio.google.com → your project → Rate limits, or enable billing for higher limits.'
      );
    }
    if (err.code === 'PARSE_ERROR' || err.code === 'INVALID_RESPONSE') {
      return 'Gemini returned an unexpected response. Try again in a moment.';
    }
    if (raw.length > 220) {
      return `${raw.slice(0, 217)}…`;
    }
    return raw;
  }
  if (err instanceof Error && err.message) {
    return err.message.length > 220 ? `${err.message.slice(0, 217)}…` : err.message;
  }
  return 'Could not reach Gemini. Check your connection and API key.';
}
