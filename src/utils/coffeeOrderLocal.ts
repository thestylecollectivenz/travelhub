import { COUNTRY_DATA } from '../data/countryData';

export type CoffeeOrderGuide = {
  preferenceLabel: string;
  placeLabel: string;
  askFor: string;
  note: string;
};

type MilkStyle = 'trim' | 'skim' | 'full' | 'soy' | 'oat' | 'almond' | 'none';

function detectMilk(preference: string): MilkStyle {
  const p = preference.toLowerCase();
  if (/\b(trim|lite|light|low.?fat)\b/.test(p)) return 'trim';
  if (/\b(skim|skimmed|non.?fat|fat.?free)\b/.test(p)) return 'skim';
  if (/\b(full.?cream|whole|regular milk)\b/.test(p)) return 'full';
  if (/\bsoy\b/.test(p)) return 'soy';
  if (/\boat\b/.test(p)) return 'oat';
  if (/\balmond\b/.test(p)) return 'almond';
  return 'none';
}

function detectDrink(preference: string): string {
  const p = preference.toLowerCase();
  if (p.includes('flat white')) return 'Flat white';
  if (p.includes('latte')) return 'Latte';
  if (p.includes('cappuccino') || p.includes('capp')) return 'Cappuccino';
  if (p.includes('long black') || p.includes('americano')) return 'Long black / Americano';
  if (p.includes('mocha')) return 'Mocha';
  if (p.includes('espresso') || p.includes('short black')) return 'Espresso';
  if (p.includes('piccolo')) return 'Piccolo';
  if (p.includes('macchiato')) return 'Macchiato';
  return preference.trim() || 'Coffee';
}

function milkPhrase(milk: MilkStyle, countryCode: string): { phrase: string; note: string } | null {
  const code = countryCode.toUpperCase();
  const region = COUNTRY_DATA[code]?.region;
  const usStyle = region === 'North America' || code === 'US' || code === 'CA';
  const ukStyle = code === 'GB' || code === 'IE';
  const asia = region === 'Southeast Asia' || region === 'East Asia';

  switch (milk) {
    case 'trim':
      if (usStyle) {
        return {
          phrase: 'with nonfat / skim milk',
          note: '“Trim” is uncommon in North America — ask for nonfat or skim.'
        };
      }
      if (ukStyle || asia) {
        return {
          phrase: 'with low-fat milk (or skimmed milk)',
          note: '“Trim milk” is a NZ/AU term — low-fat or skimmed is clearer abroad.'
        };
      }
      return {
        phrase: 'with trim / low-fat milk',
        note: 'If they look unsure, say “low-fat milk”.'
      };
    case 'skim':
      if (usStyle) return { phrase: 'with skim / nonfat milk', note: 'Skim and nonfat mean the same here.' };
      return { phrase: 'with skimmed milk', note: 'Ask for skimmed (UK spelling) if needed.' };
    case 'full':
      if (usStyle) return { phrase: 'with whole milk', note: '“Full cream” maps to whole milk.' };
      return { phrase: 'with full-cream / whole milk', note: 'Whole milk is the clearest wording.' };
    case 'soy':
      return { phrase: 'with soy milk', note: 'Most cafés understand soy milk.' };
    case 'oat':
      return { phrase: 'with oat milk', note: 'Oat milk is widely available in cities.' };
    case 'almond':
      return { phrase: 'with almond milk', note: 'Almond milk is widely available in cities.' };
    default:
      return null;
  }
}

/**
 * Turns a home-country coffee preference into a clear local ordering line.
 */
export function resolveLocalCoffeeOrder(
  preferenceRaw: string | undefined,
  countryCode: string | undefined,
  placeLabel: string
): CoffeeOrderGuide | null {
  const preference = (preferenceRaw || '').trim();
  if (!preference) return null;
  const code = (countryCode || '').trim().toUpperCase();
  const drink = detectDrink(preference);
  const milk = detectMilk(preference);
  const milkBit = milkPhrase(milk, code);
  const askFor = milkBit ? `${drink} ${milkBit.phrase}` : drink;
  const destination = placeLabel || COUNTRY_DATA[code]?.currency?.replace(/ Dollar.*$/i, '') || 'this destination';

  return {
    preferenceLabel: preference,
    placeLabel: destination,
    askFor,
    note: milkBit?.note || 'Order by drink name; add milk preference if you need it.'
  };
}
