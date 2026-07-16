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

const ESSENTIAL_ENGLISH = [
  'Hello',
  'Thank you',
  'Goodbye',
  'Please',
  'Excuse me',
  "You're welcome",
  'Where is…?',
  'How much?',
  'Help!'
] as const;

function pack(
  languageName: string,
  locals: string[],
  lang: string,
  englishWidelySpoken?: boolean
): LanguagePack {
  return {
    languageName,
    englishWidelySpoken,
    phrases: ESSENTIAL_ENGLISH.map((english, i) => ({
      english,
      local: locals[i] || english,
      lang
    }))
  };
}

const FALLBACK_PHRASES: LanguagePhrase[] = ESSENTIAL_ENGLISH.map((english) => ({
  local: english,
  english
}));

const PACKS: Record<string, LanguagePack> = {
  NL: pack(
    'Dutch',
    ['Hallo', 'Dank je wel', 'Tot ziens', 'Alsjeblieft', 'Pardon', 'Graag gedaan', 'Waar is…?', 'Hoeveel kost het?', 'Help!'],
    'nl-NL',
    true
  ),
  NO: pack(
    'Norwegian',
    ['Hei', 'Takk', 'Ha det', 'Vær så snill', 'Unnskyld', 'Vær så god', 'Hvor er…?', 'Hvor mye koster det?', 'Hjelp!'],
    'nb-NO',
    true
  ),
  DE: pack(
    'German',
    ['Hallo', 'Danke', 'Auf Wiedersehen', 'Bitte', 'Entschuldigung', 'Bitte schön', 'Wo ist…?', 'Wie viel kostet das?', 'Hilfe!'],
    'de-DE'
  ),
  FR: pack(
    'French',
    ['Bonjour', 'Merci', 'Au revoir', "S'il vous plaît", 'Pardon', 'De rien', 'Où est…?', 'Combien ça coûte?', 'Au secours!'],
    'fr-FR'
  ),
  GB: pack(
    'English',
    ['Hello', 'Thank you', 'Goodbye', 'Please', 'Excuse me', "You're welcome", 'Where is…?', 'How much?', 'Help!'],
    'en-GB',
    true
  ),
  US: pack(
    'English',
    ['Hello', 'Thank you', 'Goodbye', 'Please', 'Excuse me', "You're welcome", 'Where is…?', 'How much?', 'Help!'],
    'en-US',
    true
  ),
  ES: pack(
    'Spanish',
    ['Hola', 'Gracias', 'Adiós', 'Por favor', 'Perdón', 'De nada', '¿Dónde está…?', '¿Cuánto cuesta?', '¡Ayuda!'],
    'es-ES'
  ),
  IT: pack(
    'Italian',
    ['Ciao', 'Grazie', 'Arrivederci', 'Per favore', 'Scusi', 'Prego', "Dov'è…?", 'Quanto costa?', 'Aiuto!'],
    'it-IT'
  ),
  JP: pack(
    'Japanese',
    ['こんにちは', 'ありがとう', 'さようなら', 'お願いします', 'すみません', 'どういたしまして', '…はどこですか', 'いくらですか', '助けて！'],
    'ja-JP'
  ),
  NZ: pack(
    'Māori',
    ['Kia ora', 'Ngā mihi', 'Ka kite', 'Tēnā koa', 'Aroha mai', 'Ka pai', 'Kei hea…?', 'E hia te utu?', 'Āwhina!'],
    'mi-NZ',
    true
  ),
  AU: pack(
    'English',
    ["G'day", 'Thanks', 'See ya', 'Please', 'Excuse me', 'No worries', 'Where is…?', 'How much?', 'Help!'],
    'en-AU',
    true
  ),
  /** Mandarin phrases commonly useful for visitors; English is widely spoken. */
  SG: pack(
    'Mandarin',
    ['Ni hao', 'Xièxiè', 'Zàijiàn', 'Qǐng', 'Duìbuqǐ', 'Bú kèqì', '…zài nǎlǐ?', 'Duōshǎo qián?', 'Jiùmìng!'],
    'zh-CN',
    true
  ),
  CN: pack(
    'Mandarin',
    ['你好', '谢谢', '再见', '请', '对不起', '不客气', '…在哪里？', '多少钱？', '救命！'],
    'zh-CN'
  ),
  HK: pack(
    'Cantonese',
    ['Néih hóu', "M̀h'gōi", 'Joi gin', "M̀h'gōi", 'Mhóuyisi', 'Msái haak hei', '…hái bīndouh?', 'Géi dō chín?', 'Gau meng!'],
    'zh-HK',
    true
  ),
  TH: pack(
    'Thai',
    ['Sawasdee', 'Khob khun', 'Laa gòn', 'Karuna', 'Khor thoad', 'Yin dee', 'Yuu thee nai…?', 'Tao rai?', 'Chuay duay!'],
    'th-TH',
    true
  ),
  MY: pack(
    'Malay',
    ['Hello', 'Terima kasih', 'Selamat tinggal', 'Tolong', 'Maaf', 'Sama-sama', 'Di mana…?', 'Berapa harga?', 'Tolong!'],
    'ms-MY',
    true
  ),
  ID: pack(
    'Indonesian',
    ['Halo', 'Terima kasih', 'Selamat tinggal', 'Tolong', 'Permisi', 'Sama-sama', 'Di mana…?', 'Berapa harganya?', 'Tolong!'],
    'id-ID',
    true
  ),
  KR: pack(
    'Korean',
    ['안녕하세요', '감사합니다', '안녕히 가세요', '부탁합니다', '실례합니다', '천만에요', '…어디예요?', '얼마예요?', '도와주세요!'],
    'ko-KR'
  )
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
