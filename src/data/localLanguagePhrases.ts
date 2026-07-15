export interface LanguagePhrase {
  local: string;
  english: string;
  /** BCP-47 language tag for speech synthesis */
  lang?: string;
}

export interface LanguagePack {
  languageName: string;
  englishWidelySpoken?: boolean;
  phrases: LanguagePhrase[];
}

const FALLBACK_PHRASES: LanguagePhrase[] = [
  { local: 'Hello', english: 'Hello' },
  { local: 'Thank you', english: 'Thank you' },
  { local: 'Please', english: 'Please' },
  { local: 'Excuse me', english: 'Excuse me' },
  { local: 'Where is…?', english: 'Where is…?' },
  { local: 'How much?', english: 'How much?' }
];

const PACKS: Record<string, LanguagePack> = {
  NL: {
    languageName: 'Dutch',
    englishWidelySpoken: true,
    phrases: [
      { local: 'Hallo', english: 'Hello', lang: 'nl-NL' },
      { local: 'Dank je wel', english: 'Thank you', lang: 'nl-NL' },
      { local: 'Alsjeblieft', english: 'Please', lang: 'nl-NL' },
      { local: 'Pardon', english: 'Excuse me', lang: 'nl-NL' },
      { local: 'Waar is…?', english: 'Where is…?', lang: 'nl-NL' },
      { local: 'Hoeveel kost het?', english: 'How much?', lang: 'nl-NL' }
    ]
  },
  NO: {
    languageName: 'Norwegian',
    englishWidelySpoken: true,
    phrases: [
      { local: 'Hei', english: 'Hello', lang: 'nb-NO' },
      { local: 'Takk', english: 'Thank you', lang: 'nb-NO' },
      { local: 'Vær så snill', english: 'Please', lang: 'nb-NO' },
      { local: 'Unnskyld', english: 'Excuse me', lang: 'nb-NO' },
      { local: 'Hvor er…?', english: 'Where is…?', lang: 'nb-NO' },
      { local: 'Hvor mye koster det?', english: 'How much?', lang: 'nb-NO' }
    ]
  },
  DE: {
    languageName: 'German',
    phrases: [
      { local: 'Hallo', english: 'Hello', lang: 'de-DE' },
      { local: 'Danke', english: 'Thank you', lang: 'de-DE' },
      { local: 'Bitte', english: 'Please', lang: 'de-DE' },
      { local: 'Entschuldigung', english: 'Excuse me', lang: 'de-DE' },
      { local: 'Wo ist…?', english: 'Where is…?', lang: 'de-DE' },
      { local: 'Wie viel kostet das?', english: 'How much?', lang: 'de-DE' }
    ]
  },
  FR: {
    languageName: 'French',
    phrases: [
      { local: 'Bonjour', english: 'Hello', lang: 'fr-FR' },
      { local: 'Merci', english: 'Thank you', lang: 'fr-FR' },
      { local: "S'il vous plaît", english: 'Please', lang: 'fr-FR' },
      { local: 'Pardon', english: 'Excuse me', lang: 'fr-FR' },
      { local: 'Où est…?', english: 'Where is…?', lang: 'fr-FR' },
      { local: 'Combien ça coûte?', english: 'How much?', lang: 'fr-FR' }
    ]
  },
  GB: {
    languageName: 'English',
    englishWidelySpoken: true,
    phrases: [
      { local: 'Hello', english: 'Hello', lang: 'en-GB' },
      { local: 'Thank you', english: 'Thank you', lang: 'en-GB' },
      { local: 'Please', english: 'Please', lang: 'en-GB' },
      { local: 'Excuse me', english: 'Excuse me', lang: 'en-GB' },
      { local: 'Where is…?', english: 'Where is…?', lang: 'en-GB' },
      { local: 'How much?', english: 'How much?', lang: 'en-GB' }
    ]
  },
  US: {
    languageName: 'English',
    englishWidelySpoken: true,
    phrases: [
      { local: 'Hello', english: 'Hello', lang: 'en-US' },
      { local: 'Thank you', english: 'Thank you', lang: 'en-US' },
      { local: 'Please', english: 'Please', lang: 'en-US' },
      { local: 'Excuse me', english: 'Excuse me', lang: 'en-US' },
      { local: 'Where is…?', english: 'Where is…?', lang: 'en-US' },
      { local: 'How much?', english: 'How much?', lang: 'en-US' }
    ]
  },
  ES: {
    languageName: 'Spanish',
    phrases: [
      { local: 'Hola', english: 'Hello', lang: 'es-ES' },
      { local: 'Gracias', english: 'Thank you', lang: 'es-ES' },
      { local: 'Por favor', english: 'Please', lang: 'es-ES' },
      { local: 'Perdón', english: 'Excuse me', lang: 'es-ES' },
      { local: '¿Dónde está…?', english: 'Where is…?', lang: 'es-ES' },
      { local: '¿Cuánto cuesta?', english: 'How much?', lang: 'es-ES' }
    ]
  },
  IT: {
    languageName: 'Italian',
    phrases: [
      { local: 'Ciao', english: 'Hello', lang: 'it-IT' },
      { local: 'Grazie', english: 'Thank you', lang: 'it-IT' },
      { local: 'Per favore', english: 'Please', lang: 'it-IT' },
      { local: 'Scusi', english: 'Excuse me', lang: 'it-IT' },
      { local: 'Dov\'è…?', english: 'Where is…?', lang: 'it-IT' },
      { local: 'Quanto costa?', english: 'How much?', lang: 'it-IT' }
    ]
  },
  JP: {
    languageName: 'Japanese',
    phrases: [
      { local: 'こんにちは', english: 'Hello', lang: 'ja-JP' },
      { local: 'ありがとう', english: 'Thank you', lang: 'ja-JP' },
      { local: 'お願いします', english: 'Please', lang: 'ja-JP' },
      { local: 'すみません', english: 'Excuse me', lang: 'ja-JP' },
      { local: '…はどこですか', english: 'Where is…?', lang: 'ja-JP' },
      { local: 'いくらですか', english: 'How much?', lang: 'ja-JP' }
    ]
  },
  NZ: {
    languageName: 'Māori',
    englishWidelySpoken: true,
    phrases: [
      { local: 'Kia ora', english: 'Hello', lang: 'mi-NZ' },
      { local: 'Ngā mihi', english: 'Thank you', lang: 'mi-NZ' },
      { local: 'Tēnā koa', english: 'Please', lang: 'mi-NZ' },
      { local: 'Aroha mai', english: 'Excuse me', lang: 'mi-NZ' },
      { local: 'Kei hea…?', english: 'Where is…?', lang: 'mi-NZ' },
      { local: 'E hia te utu?', english: 'How much?', lang: 'mi-NZ' }
    ]
  },
  AU: {
    languageName: 'English',
    englishWidelySpoken: true,
    phrases: [
      { local: 'G\'day', english: 'Hello', lang: 'en-AU' },
      { local: 'Thanks', english: 'Thank you', lang: 'en-AU' },
      { local: 'Please', english: 'Please', lang: 'en-AU' },
      { local: 'Excuse me', english: 'Excuse me', lang: 'en-AU' },
      { local: 'Where is…?', english: 'Where is…?', lang: 'en-AU' },
      { local: 'How much?', english: 'How much?', lang: 'en-AU' }
    ]
  }
};

export function languagePackForCountry(countryCode?: string): LanguagePack {
  const code = (countryCode || '').trim().toUpperCase();
  if (code && PACKS[code]) return PACKS[code];
  return {
    languageName: 'Local language',
    englishWidelySpoken: true,
    phrases: FALLBACK_PHRASES
  };
}
