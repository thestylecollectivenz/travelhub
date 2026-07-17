import { COUNTRY_DATA } from '../data/countryData';
import { languagePackForCountry } from '../data/localLanguagePhrases';

export type CoffeeOrderGuide = {
  preferenceLabel: string;
  placeLabel: string;
  askForEnglish: string;
  askForLocal: string;
  localLanguageName: string;
  speechLang?: string;
  note: string;
};

type MilkStyle = 'trim' | 'skim' | 'full' | 'soy' | 'oat' | 'almond' | 'coconut' | 'lactose-free' | 'none';

type ParsedCoffee = {
  drink: string;
  milk: MilkStyle;
  size?: string;
  shots?: string;
  sugarFree: boolean;
  extras: string[];
};

function detectMilk(preference: string): MilkStyle {
  const p = preference.toLowerCase();
  if (/\b(trim|lite|light|low.?fat)\b/.test(p)) return 'trim';
  if (/\b(skim|skimmed|non.?fat|fat.?free)\b/.test(p)) return 'skim';
  if (/\b(full.?cream|whole|regular milk)\b/.test(p)) return 'full';
  if (/\b(lactose.?free)\b/.test(p)) return 'lactose-free';
  if (/\bsoy\b/.test(p)) return 'soy';
  if (/\boat\b/.test(p)) return 'oat';
  if (/\balmond\b/.test(p)) return 'almond';
  if (/\bcoconut\b/.test(p)) return 'coconut';
  return 'none';
}

function detectDrink(preference: string): string {
  const p = preference.toLowerCase();
  if (p.includes('flat white')) return 'flat white';
  if (p.includes('latte')) return 'latte';
  if (p.includes('cappuccino') || p.includes('capp')) return 'cappuccino';
  if (p.includes('long black') || p.includes('americano')) return 'long black';
  if (p.includes('mocha')) return 'mocha';
  if (p.includes('espresso') || p.includes('short black')) return 'espresso';
  if (p.includes('piccolo')) return 'piccolo';
  if (p.includes('macchiato')) return 'macchiato';
  if (p.includes('cortado')) return 'cortado';
  if (p.includes('chai')) return 'chai latte';
  if (p.includes('matcha')) return 'matcha latte';
  if (p.includes('cold brew')) return 'cold brew';
  if (p.includes('iced')) return 'iced coffee';
  return preference.trim().split(/[,;]/)[0]?.trim().toLowerCase() || 'coffee';
}

function detectSize(preference: string): string | undefined {
  const p = preference.toLowerCase();
  if (/\b(extra.?large|xl|venti)\b/.test(p)) return 'extra large';
  if (/\b(large|grande|big)\b/.test(p)) return 'large';
  if (/\b(medium|regular|tall)\b/.test(p)) return 'medium';
  if (/\b(small|short|piccolo.?size)\b/.test(p)) return 'small';
  return undefined;
}

function detectShots(preference: string): string | undefined {
  const p = preference.toLowerCase();
  const num = p.match(/\b(\d)\s*shots?\b/);
  if (num) return `${num[1]} shots`;
  if (/\b(extra shot|double shot|doppio|2 shots)\b/.test(p)) return 'double shot';
  if (/\b(single shot|1 shot)\b/.test(p)) return 'single shot';
  if (/\bdecaf\b/.test(p)) return 'decaf';
  if (/\b(extra.?strong|strong)\b/.test(p)) return 'extra strong';
  return undefined;
}

function detectSugarFree(preference: string): boolean {
  return /\b(sugar.?free|no sugar|unsweetened|without sugar)\b/i.test(preference);
}

const EXTRA_PATTERNS: Array<{ re: RegExp; label: string }> = [
  { re: /\bextra hot\b/i, label: 'extra hot' },
  { re: /\biced\b/i, label: 'iced' },
  { re: /\bwith ice\b/i, label: 'with ice' },
  { re: /\bno foam\b/i, label: 'no foam' },
  { re: /\bextra foam\b/i, label: 'extra foam' },
  { re: /\bweak\b/i, label: 'weak' },
  { re: /\bhalf.?strength\b/i, label: 'half strength' },
  { re: /\btakeaway\b/i, label: 'takeaway' },
  { re: /\bto go\b/i, label: 'to go' },
  { re: /\bfor here\b/i, label: 'for here' }
];

const TOPPING_PATTERNS: Array<{ re: RegExp; label: string }> = [
  { re: /\bvanilla\b/i, label: 'vanilla' },
  { re: /\bcaramel\b/i, label: 'caramel' },
  { re: /\bhazelnut\b/i, label: 'hazelnut' },
  { re: /\bcinnamon\b/i, label: 'cinnamon' },
  { re: /\bchocolate\b/i, label: 'chocolate' },
  { re: /\bchai spice\b/i, label: 'chai spice' },
  { re: /\bwhip(ped)? cream\b/i, label: 'whipped cream' },
  { re: /\bdrizzle\b/i, label: 'drizzle' },
  { re: /\bsprinkles\b/i, label: 'sprinkles' }
];

function detectExtras(preference: string, drink: string, milk: MilkStyle): string[] {
  const found = new Set<string>();
  for (const { re, label } of [...EXTRA_PATTERNS, ...TOPPING_PATTERNS]) {
    if (re.test(preference)) found.add(label);
  }

  // Strip known drink/milk/size/shot/topping tokens so residual fragments are not re-added.
  let residual = preference.toLowerCase();
  residual = residual.replace(new RegExp(drink.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'gi'), ' ');
  residual = residual.replace(
    /\b(double\s*shot|single\s*shot|extra\s*shot|doppio|\d\s*shots?|decaf|extra\s*strong|strong)\b/gi,
    ' '
  );
  residual = residual.replace(
    /\b(trim|lite|light|low[-\s]?fat|skim(?:med)?|non[-\s]?fat|fat[-\s]?free|full[-\s]?cream|whole|regular\s+milk|lactose[-\s]?free|soy|oat|almond|coconut|milk)\b/gi,
    ' '
  );
  residual = residual.replace(
    /\b(extra[-\s]?large|xl|venti|large|grande|big|medium|regular|tall|small|short)\b/gi,
    ' '
  );
  residual = residual.replace(/\b(sugar[-\s]?free|no\s+sugar|unsweetened|without\s+sugar)\b/gi, ' ');
  for (const { re } of [...EXTRA_PATTERNS, ...TOPPING_PATTERNS]) {
    residual = residual.replace(re, ' ');
  }
  residual = residual.replace(/\b(with|and|plus|a|an|the)\b/gi, ' ');
  residual = residual.replace(/[^a-z0-9\s-]/gi, ' ').replace(/\s+/g, ' ').trim();

  if (residual.length > 2 && residual.length < 40 && !found.has(residual)) {
    // Only keep residual if it looks like a real modifier, not connector debris.
    if (!/^(with|and|double|shot|shots)$/i.test(residual)) {
      found.add(residual);
    }
  }

  if (milk !== 'none') {
    for (const key of Array.from(found)) {
      if (/\bmilk\b/.test(key)) found.delete(key);
    }
  }
  return Array.from(found);
}

function parseCoffeePreference(preference: string): ParsedCoffee {
  const drink = detectDrink(preference);
  const milk = detectMilk(preference);
  return {
    drink,
    milk,
    size: detectSize(preference),
    shots: detectShots(preference),
    sugarFree: detectSugarFree(preference),
    extras: detectExtras(preference, drink, milk)
  };
}

function milkPhraseEnglish(milk: MilkStyle, countryCode: string): { phrase: string; note: string } | null {
  const code = countryCode.toUpperCase();
  const region = COUNTRY_DATA[code]?.region;
  const usStyle = region === 'North America' || code === 'US' || code === 'CA';
  const ukStyle = code === 'GB' || code === 'IE';
  const asia = region === 'Southeast Asia' || region === 'East Asia';

  switch (milk) {
    case 'trim':
      if (usStyle) {
        return { phrase: 'with nonfat milk', note: '“Trim” is uncommon in North America — ask for nonfat or skim.' };
      }
      if (ukStyle || asia) {
        return { phrase: 'with low-fat milk', note: '“Trim milk” is a NZ/AU term — low-fat or skimmed is clearer abroad.' };
      }
      return { phrase: 'with trim / low-fat milk', note: 'If they look unsure, say “low-fat milk”.' };
    case 'skim':
      if (usStyle) return { phrase: 'with skim milk', note: 'Skim and nonfat mean the same here.' };
      return { phrase: 'with skimmed milk', note: 'Ask for skimmed (UK spelling) if needed.' };
    case 'full':
      if (usStyle) return { phrase: 'with whole milk', note: '“Full cream” maps to whole milk.' };
      return { phrase: 'with full-cream milk', note: 'Whole milk is the clearest wording.' };
    case 'lactose-free':
      return { phrase: 'with lactose-free milk', note: 'Lactose-free milk is widely understood.' };
    case 'soy':
      return { phrase: 'with soy milk', note: 'Most cafés understand soy milk.' };
    case 'oat':
      return { phrase: 'with oat milk', note: 'Oat milk is widely available in cities.' };
    case 'almond':
      return { phrase: 'with almond milk', note: 'Almond milk is widely available in cities.' };
    case 'coconut':
      return { phrase: 'with coconut milk', note: 'Coconut milk may be less common — confirm if needed.' };
    default:
      return null;
  }
}

function capitalizeDrink(drink: string): string {
  return drink
    .split(' ')
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(' ');
}

function buildEnglishOrder(parsed: ParsedCoffee, countryCode: string): { line: string; note: string } {
  const parts: string[] = [];
  if (parsed.size) parts.push(parsed.size);
  parts.push(capitalizeDrink(parsed.drink));
  if (parsed.shots) parts.push(`(${parsed.shots})`);
  const milkBit = milkPhraseEnglish(parsed.milk, countryCode);
  if (milkBit) parts.push(milkBit.phrase);
  if (parsed.sugarFree) parts.push('sugar-free');
  for (const extra of parsed.extras) {
    if (!parts.some((p) => p.toLowerCase().includes(extra))) parts.push(extra);
  }
  const line = parts.join(', ').replace(/, \(/g, ' (').replace(/\), /g, ') ');
  return { line, note: milkBit?.note || 'Order by drink name; add size, milk, and extras as needed.' };
}

type CoffeeLexicon = {
  with: string;
  sugarFree: string;
  size: Record<string, string>;
  milk: Partial<Record<MilkStyle, string>>;
  drinks: Record<string, string>;
};

const LEXICONS: Record<string, CoffeeLexicon> = {
  'fr-FR': {
    with: 'avec',
    sugarFree: 'sans sucre',
    size: { small: 'petit', medium: 'moyen', large: 'grand', 'extra large': 'très grand' },
    milk: {
      trim: 'lait demi-écrémé',
      skim: 'lait écrémé',
      full: 'lait entier',
      soy: 'lait de soja',
      oat: 'lait d\'avoine',
      almond: 'lait d\'amande',
      coconut: 'lait de coco',
      'lactose-free': 'lait sans lactose'
    },
    drinks: {
      'flat white': 'flat white',
      latte: 'café latte',
      cappuccino: 'cappuccino',
      'long black': 'café allongé',
      mocha: 'moka',
      espresso: 'espresso',
      macchiato: 'macchiato'
    }
  },
  'de-DE': {
    with: 'mit',
    sugarFree: 'zuckerfrei',
    size: { small: 'klein', medium: 'mittel', large: 'groß', 'extra large': 'extra groß' },
    milk: {
      trim: 'fettarmer Milch',
      skim: 'Magermilch',
      full: 'Vollmilch',
      soy: 'Sojamilch',
      oat: 'Hafermilch',
      almond: 'Mandelmilch',
      coconut: 'Kokosmilch',
      'lactose-free': 'laktosefreier Milch'
    },
    drinks: {
      'flat white': 'Flat White',
      latte: 'Milchkaffee',
      cappuccino: 'Cappuccino',
      'long black': 'Americano',
      mocha: 'Mokka',
      espresso: 'Espresso',
      macchiato: 'Macchiato'
    }
  },
  'es-ES': {
    with: 'con',
    sugarFree: 'sin azúcar',
    size: { small: 'pequeño', medium: 'mediano', large: 'grande', 'extra large': 'extra grande' },
    milk: {
      trim: 'leche desnatada',
      skim: 'leche desnatada',
      full: 'leche entera',
      soy: 'leche de soja',
      oat: 'leche de avena',
      almond: 'leche de almendra',
      coconut: 'leche de coco',
      'lactose-free': 'leche sin lactosa'
    },
    drinks: {
      'flat white': 'flat white',
      latte: 'café con leche',
      cappuccino: 'capuchino',
      'long black': 'café americano',
      mocha: 'moca',
      espresso: 'espresso',
      macchiato: 'macchiato'
    }
  },
  'it-IT': {
    with: 'con',
    sugarFree: 'senza zucchero',
    size: { small: 'piccolo', medium: 'medio', large: 'grande', 'extra large': 'molto grande' },
    milk: {
      trim: 'latte scremato',
      skim: 'latte scremato',
      full: 'latte intero',
      soy: 'latte di soia',
      oat: 'latte d\'avena',
      almond: 'latte di mandorla',
      coconut: 'latte di cocco',
      'lactose-free': 'latte senza lattosio'
    },
    drinks: {
      'flat white': 'flat white',
      latte: 'caffè latte',
      cappuccino: 'cappuccino',
      'long black': 'caffè americano',
      mocha: 'mocha',
      espresso: 'espresso',
      macchiato: 'macchiato'
    }
  },
  'nl-NL': {
    with: 'met',
    sugarFree: 'zonder suiker',
    size: { small: 'klein', medium: 'middel', large: 'groot', 'extra large': 'extra groot' },
    milk: {
      trim: 'magere melk',
      skim: 'magere melk',
      full: 'volle melk',
      soy: 'sojamelk',
      oat: 'havermelk',
      almond: 'amandelmelk',
      coconut: 'kokosmelk',
      'lactose-free': 'lactosevrije melk'
    },
    drinks: {
      'flat white': 'flat white',
      latte: 'latte macchiato',
      cappuccino: 'cappuccino',
      'long black': 'americano',
      mocha: 'mokka',
      espresso: 'espresso',
      macchiato: 'macchiato'
    }
  },
  'nb-NO': {
    with: 'med',
    sugarFree: 'uten sukker',
    size: { small: 'liten', medium: 'medium', large: 'stor', 'extra large': 'ekstra stor' },
    milk: {
      trim: 'lettmelk',
      skim: 'skummet melk',
      full: 'helmelk',
      soy: 'soyamelk',
      oat: 'havremelk',
      almond: 'mandelmelk',
      coconut: 'kokosmelk',
      'lactose-free': 'laktosefri melk'
    },
    drinks: {
      'flat white': 'flat white',
      latte: 'caffe latte',
      cappuccino: 'cappuccino',
      'long black': 'americano',
      mocha: 'mokka',
      espresso: 'espresso',
      macchiato: 'macchiato'
    }
  },
  'ja-JP': {
    with: 'で',
    sugarFree: '砂糖なし',
    size: { small: 'Sサイズ', medium: 'Mサイズ', large: 'Lサイズ', 'extra large': 'XLサイズ' },
    milk: {
      soy: '豆乳',
      oat: 'オーツミルク',
      almond: 'アーモンドミルク',
      full: '牛乳',
      skim: 'スキムミルク'
    },
    drinks: {
      'flat white': 'フラットホワイト',
      latte: 'ラテ',
      cappuccino: 'カプチーノ',
      'long black': 'アメリカーノ',
      mocha: 'モカ',
      espresso: 'エスプレッソ',
      macchiato: 'マキアート'
    }
  },
  'th-TH': {
    with: 'ใส่',
    sugarFree: 'ไม่ใส่น้ำตาล',
    size: { small: 'เล็ก', medium: 'กลาง', large: 'ใหญ่', 'extra large': 'ใหญ่พิเศษ' },
    milk: { soy: 'นมถั่วเหลือง', oat: 'นมโอ๊ต', almond: 'นมอัลมอนด์', full: 'นมสด' },
    drinks: {
      latte: 'ลาเต้',
      cappuccino: 'คาปูชิโน่',
      espresso: 'เอสเปรสโซ่',
      mocha: 'มอคค่า'
    }
  }
};

function resolveLexicon(lang?: string): CoffeeLexicon | null {
  if (!lang) return null;
  if (LEXICONS[lang]) return LEXICONS[lang];
  const base = lang.split('-')[0];
  const hit = Object.entries(LEXICONS).find(([k]) => k.startsWith(`${base}-`));
  return hit ? hit[1] : null;
}

const EXTRA_LOCAL: Record<string, Record<string, string>> = {
  'fr-FR': { cinnamon: 'cannelle', vanilla: 'vanille', caramel: 'caramel', hazelnut: 'noisette', chocolate: 'chocolat' },
  'de-DE': { cinnamon: 'Zimt', vanilla: 'Vanille', caramel: 'Karamell', hazelnut: 'Haselnuss', chocolate: 'Schokolade' },
  'es-ES': { cinnamon: 'canela', vanilla: 'vainilla', caramel: 'caramelo', hazelnut: 'avellana', chocolate: 'chocolate' },
  'it-IT': { cinnamon: 'cannella', vanilla: 'vaniglia', caramel: 'caramello', hazelnut: 'nocciola', chocolate: 'cioccolato' },
  'nl-NL': { cinnamon: 'kaneel', vanilla: 'vanille', caramel: 'karamel', hazelnut: 'hazelnoot', chocolate: 'chocolade' },
  'nb-NO': { cinnamon: 'kanel', vanilla: 'vanilje', caramel: 'karamell', hazelnut: 'hasselnøtt', chocolate: 'sjokolade' },
  'ja-JP': { cinnamon: 'シナモン', vanilla: 'バニラ', caramel: 'キャラメル', hazelnut: 'ヘーゼルナッツ', chocolate: 'チョコレート' },
  'th-TH': { cinnamon: 'อบเชย', vanilla: 'วานิลลา', caramel: 'คาราเมล', hazelnut: 'เฮเซลนัท', chocolate: 'ช็อกโกแลต' }
};

function localizeExtra(extra: string, lang?: string): string {
  if (!lang) return extra;
  const direct = EXTRA_LOCAL[lang];
  if (direct?.[extra]) return direct[extra];
  const base = lang.split('-')[0];
  const hit = Object.entries(EXTRA_LOCAL).find(([k]) => k.startsWith(`${base}-`));
  return hit?.[1]?.[extra] || extra;
}

function buildLocalOrder(parsed: ParsedCoffee, lang?: string): string {
  const lex = resolveLexicon(lang);
  if (!lex) return '';

  const parts: string[] = [];
  if (parsed.size && lex.size[parsed.size]) parts.push(lex.size[parsed.size]);
  const drinkLocal = lex.drinks[parsed.drink] || capitalizeDrink(parsed.drink);
  parts.push(drinkLocal);
  if (parsed.milk !== 'none' && lex.milk[parsed.milk]) {
    parts.push(`${lex.with} ${lex.milk[parsed.milk]}`);
  }
  if (parsed.sugarFree) parts.push(lex.sugarFree);
  if (parsed.shots && !parsed.shots.includes('decaf')) {
    parts.push(parsed.shots);
  } else if (parsed.shots === 'decaf') {
    parts.push('decaf');
  }
  for (const extra of parsed.extras) {
    const local = localizeExtra(extra, lang);
    if (!parts.some((p) => p.toLowerCase().includes(local.toLowerCase()) || p.toLowerCase().includes(extra))) {
      parts.push(local);
    }
  }
  return parts.join(', ');
}

/**
 * Turns a home-country coffee preference into clear English and local ordering lines.
 */
export function resolveLocalCoffeeOrder(
  preferenceRaw: string | undefined,
  countryCode: string | undefined,
  placeLabel: string
): CoffeeOrderGuide | null {
  const preference = (preferenceRaw || '').trim();
  if (!preference) return null;
  const code = (countryCode || '').trim().toUpperCase();
  const parsed = parseCoffeePreference(preference);
  const english = buildEnglishOrder(parsed, code);
  const langPack = languagePackForCountry(code);
  const speechLang = langPack.phrases.find((p) => p.lang)?.lang;
  const localLine = buildLocalOrder(parsed, speechLang);
  const destination = placeLabel || COUNTRY_DATA[code]?.currency?.replace(/ Dollar.*$/i, '') || 'this destination';

  return {
    preferenceLabel: preference,
    placeLabel: destination,
    askForEnglish: english.line,
    askForLocal: localLine || english.line,
    localLanguageName: langPack.languageName,
    speechLang,
    note: english.note
  };
}

/** @deprecated Use askForEnglish */
export function legacyAskFor(guide: CoffeeOrderGuide): string {
  return guide.askForEnglish;
}
