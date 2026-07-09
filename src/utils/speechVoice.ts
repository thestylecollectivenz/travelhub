import {
  DEFAULT_ELEVENLABS_VOICE_ID,
  synthesizeElevenLabsSpeech
} from '../services/ElevenLabsService';

export type SpeechOutputState = 'idle' | 'speaking' | 'paused';

export type SpeechEngine = 'browser' | 'elevenlabs';

export interface BrowserSpeechVoiceOption {
  voiceURI: string;
  name: string;
  lang: string;
  localService: boolean;
  /** Higher = more natural / preferred for Travel Hub defaults. */
  naturalScore: number;
  label: string;
}

export interface SpeakOptions {
  speechEngine?: SpeechEngine;
  browserVoiceURI?: string;
  elevenLabsApiKey?: string;
  elevenLabsVoiceId?: string;
}

type SpeechRecognitionCtor = new () => {
  lang: string;
  continuous: boolean;
  interimResults: boolean;
  maxAlternatives: number;
  onresult: ((event: SpeechRecognitionResultEvent) => void) | null;
  onerror: (() => void) | null;
  onend: (() => void) | null;
  start: () => void;
  stop: () => void;
  abort: () => void;
};

export interface SpeechRecognitionResultEvent {
  resultIndex: number;
  results: Array<{ isFinal: boolean; 0?: { transcript?: string } }>;
}

let activeAudio: HTMLAudioElement | undefined;
let activeObjectUrl: string | undefined;
let stateListener: ((state: SpeechOutputState) => void) | undefined;

function clearActiveAudio(): void {
  if (activeAudio) {
    try {
      activeAudio.pause();
    } catch {
      /* ignore */
    }
    try {
      activeAudio.removeAttribute('src');
      activeAudio.load();
    } catch {
      /* ignore */
    }
  }
  activeAudio = undefined;
  if (activeObjectUrl) {
    try {
      URL.revokeObjectURL(activeObjectUrl);
    } catch {
      /* ignore */
    }
  }
  activeObjectUrl = undefined;
}

function notifyState(state: SpeechOutputState): void {
  stateListener?.(state);
}

export function getSpeechRecognitionCtor(): SpeechRecognitionCtor | undefined {
  if (typeof window === 'undefined') return undefined;
  const w = window as Window & {
    SpeechRecognition?: SpeechRecognitionCtor;
    webkitSpeechRecognition?: SpeechRecognitionCtor;
  };
  return w.SpeechRecognition || w.webkitSpeechRecognition;
}

export function stopSpeechOutput(): void {
  if (typeof window === 'undefined') return;
  if (window.speechSynthesis) window.speechSynthesis.cancel();
  clearActiveAudio();
  notifyState('idle');
}

export function pauseSpeechOutput(): boolean {
  if (typeof window === 'undefined') return false;
  if (activeAudio && !activeAudio.paused) {
    activeAudio.pause();
    notifyState('paused');
    return true;
  }
  if (!window.speechSynthesis) return false;
  if (!window.speechSynthesis.speaking || window.speechSynthesis.paused) return false;
  window.speechSynthesis.pause();
  notifyState('paused');
  return true;
}

export function resumeSpeechOutput(): boolean {
  if (typeof window === 'undefined') return false;
  if (activeAudio && activeAudio.paused && !activeAudio.ended) {
    void activeAudio.play().then(() => notifyState('speaking')).catch(() => notifyState('idle'));
    return true;
  }
  if (!window.speechSynthesis) return false;
  if (!window.speechSynthesis.paused) return false;
  window.speechSynthesis.resume();
  notifyState('speaking');
  return true;
}

export function getSpeechOutputState(): SpeechOutputState {
  if (typeof window === 'undefined') return 'idle';
  if (activeAudio) {
    if (activeAudio.paused && !activeAudio.ended && activeAudio.currentTime > 0) return 'paused';
    if (!activeAudio.paused && !activeAudio.ended) return 'speaking';
  }
  if (!window.speechSynthesis) return 'idle';
  if (window.speechSynthesis.paused) return 'paused';
  if (window.speechSynthesis.speaking) return 'speaking';
  return 'idle';
}

/** Score browser voices so neural / Natural / Online voices rank above older desktop TTS. */
export function scoreBrowserVoiceNaturalness(voice: SpeechSynthesisVoice): number {
  const name = (voice.name || '').toLowerCase();
  const lang = (voice.lang || '').toLowerCase();
  let score = 0;

  if (lang.startsWith('en-nz')) score += 40;
  else if (lang.startsWith('en-au')) score += 36;
  else if (lang.startsWith('en-gb')) score += 34;
  else if (lang.startsWith('en-us')) score += 30;
  else if (lang.startsWith('en-')) score += 18;
  else score -= 20;

  if (/\b(natural|neural|online|premium|enhanced|wavenet|studio)\b/.test(name)) score += 50;
  if (/microsoft/.test(name) && /online/.test(name)) score += 20;
  if (/google/.test(name)) score += 15;
  if (/\b(aria|jenny|guy|sonia|ryan|natasha|michelle|hazel|susan|george|libby)\b/.test(name)) score += 12;

  // Older Windows desktop voices are noticeably more robotic.
  if (/\bdesktop\b/.test(name)) score -= 35;
  if (/\b(zira|david|mark|hazel desktop)\b/.test(name) && !/natural|neural|online/.test(name)) score -= 25;
  if (voice.localService && !/natural|neural|online|google/.test(name)) score -= 8;

  return score;
}

function formatBrowserVoiceLabel(voice: SpeechSynthesisVoice, naturalScore: number): string {
  const bits: string[] = [voice.name];
  if (voice.lang) bits.push(voice.lang);
  if (naturalScore >= 70) bits.push('natural');
  else if (naturalScore >= 40) bits.push('clear');
  return bits.join(' · ');
}

export function listBrowserSpeechVoices(): BrowserSpeechVoiceOption[] {
  if (typeof window === 'undefined' || !window.speechSynthesis) return [];
  const voices = window.speechSynthesis.getVoices() || [];
  const mapped: BrowserSpeechVoiceOption[] = voices.map((v) => {
    const naturalScore = scoreBrowserVoiceNaturalness(v);
    return {
      voiceURI: v.voiceURI,
      name: v.name,
      lang: v.lang,
      localService: v.localService,
      naturalScore,
      label: formatBrowserVoiceLabel(v, naturalScore)
    };
  });
  mapped.sort((a, b) => {
    if (b.naturalScore !== a.naturalScore) return b.naturalScore - a.naturalScore;
    return a.name.localeCompare(b.name, undefined, { sensitivity: 'base' });
  });
  return mapped;
}

/** Wait for Chrome/Edge async voice list population. */
export function loadBrowserSpeechVoices(): Promise<BrowserSpeechVoiceOption[]> {
  if (typeof window === 'undefined' || !window.speechSynthesis) {
    return Promise.resolve([]);
  }
  const immediate = listBrowserSpeechVoices();
  if (immediate.length) return Promise.resolve(immediate);

  return new Promise((resolve) => {
    let settled = false;
    const onVoicesChanged = (): void => {
      if (settled) return;
      settled = true;
      window.speechSynthesis.removeEventListener('voiceschanged', onVoicesChanged);
      resolve(listBrowserSpeechVoices());
    };
    window.speechSynthesis.addEventListener('voiceschanged', onVoicesChanged);
    window.setTimeout(onVoicesChanged, 750);
  });
}

export function pickDefaultBrowserVoiceURI(voices?: BrowserSpeechVoiceOption[]): string {
  const list = voices ?? listBrowserSpeechVoices();
  if (!list.length) return '';
  return list[0].voiceURI;
}

function resolveBrowserVoice(voiceURI?: string): SpeechSynthesisVoice | undefined {
  if (typeof window === 'undefined' || !window.speechSynthesis) return undefined;
  const voices = window.speechSynthesis.getVoices() || [];
  const wanted = (voiceURI || '').trim();
  if (wanted) {
    const exact = voices.find((v) => v.voiceURI === wanted || v.name === wanted);
    if (exact) return exact;
  }
  const ranked = listBrowserSpeechVoices();
  if (!ranked.length) return voices[0];
  return voices.find((v) => v.voiceURI === ranked[0].voiceURI) ?? voices[0];
}

function speakWithBrowser(
  text: string,
  onStateChange?: (state: SpeechOutputState) => void,
  voiceURI?: string
): void {
  if (typeof window === 'undefined' || !window.speechSynthesis) return;
  const utter = new SpeechSynthesisUtterance(text);
  const voice = resolveBrowserVoice(voiceURI);
  if (voice) {
    utter.voice = voice;
    if (voice.lang) utter.lang = voice.lang;
  } else {
    utter.lang = 'en-NZ';
  }
  // Slightly slower than default often sounds more natural for travel narration.
  utter.rate = 0.95;
  utter.pitch = 1;
  utter.onstart = () => onStateChange?.('speaking');
  utter.onpause = () => onStateChange?.('paused');
  utter.onresume = () => onStateChange?.('speaking');
  utter.onend = () => onStateChange?.('idle');
  utter.onerror = () => onStateChange?.('idle');
  window.speechSynthesis.speak(utter);
}

async function speakWithElevenLabs(
  text: string,
  apiKey: string,
  voiceId: string,
  onStateChange?: (state: SpeechOutputState) => void
): Promise<void> {
  const blob = await synthesizeElevenLabsSpeech({
    apiKey,
    voiceId: voiceId || DEFAULT_ELEVENLABS_VOICE_ID,
    text
  });
  if (typeof window === 'undefined') return;
  clearActiveAudio();
  const objectUrl = URL.createObjectURL(blob);
  const audio = new Audio(objectUrl);
  activeAudio = audio;
  activeObjectUrl = objectUrl;
  audio.onplay = () => onStateChange?.('speaking');
  audio.onpause = () => {
    if (!audio.ended) onStateChange?.('paused');
  };
  audio.onended = () => {
    clearActiveAudio();
    onStateChange?.('idle');
  };
  audio.onerror = () => {
    clearActiveAudio();
    onStateChange?.('idle');
  };
  await audio.play();
}

/**
 * Default engine is free browser speech. ElevenLabs only when explicitly selected
 * and an API key is present; falls back to browser speech on failure.
 */
export function speakPlainText(
  text: string,
  onStateChange?: (state: SpeechOutputState) => void,
  options?: SpeakOptions
): void {
  const t = (text || '').trim();
  if (!t || typeof window === 'undefined') return;
  stateListener = onStateChange;
  stopSpeechOutput();
  stateListener = onStateChange;

  const engine: SpeechEngine = options?.speechEngine === 'elevenlabs' ? 'elevenlabs' : 'browser';
  const key = (options?.elevenLabsApiKey || '').trim();
  const browserVoiceURI = (options?.browserVoiceURI || '').trim();

  if (engine === 'elevenlabs' && key) {
    onStateChange?.('speaking');
    void speakWithElevenLabs(t, key, (options?.elevenLabsVoiceId || '').trim(), onStateChange).catch(() => {
      speakWithBrowser(t, onStateChange, browserVoiceURI);
    });
    return;
  }

  speakWithBrowser(t, onStateChange, browserVoiceURI);
}

export function collectFinalTranscript(event: SpeechRecognitionResultEvent): string {
  let chunk = '';
  for (let i = event.resultIndex; i < event.results.length; i += 1) {
    const result = event.results[i];
    if (!result?.isFinal) continue;
    chunk += result[0]?.transcript || '';
  }
  return chunk.trim();
}
