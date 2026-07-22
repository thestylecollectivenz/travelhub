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
  /** BCP-47 language tag — pick a matching voice for native accents (e.g. fr-FR, ja-JP). */
  lang?: string;
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
let browserSpeakToken = 0;

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

function speechSynthesisBusy(): boolean {
  if (typeof window === 'undefined' || !window.speechSynthesis) return false;
  return window.speechSynthesis.speaking || window.speechSynthesis.pending || window.speechSynthesis.paused;
}

/** iPad/iPhone: async speak after cancel() loses the user-gesture and silently fails. */
function isAppleTouchBrowser(): boolean {
  if (typeof navigator === 'undefined') return false;
  const ua = navigator.userAgent || '';
  if (/iPad|iPhone|iPod/i.test(ua)) return true;
  // iPadOS desktop UA
  return navigator.platform === 'MacIntel' && (navigator.maxTouchPoints || 0) > 1;
}

export function stopSpeechOutput(): void {
  if (typeof window === 'undefined') return;
  const busy = speechSynthesisBusy() || Boolean(activeAudio);
  browserSpeakToken += 1;
  if (busy && window.speechSynthesis) window.speechSynthesis.cancel();
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

function resolveBrowserVoice(voiceURI?: string, langHint?: string): SpeechSynthesisVoice | undefined {
  if (typeof window === 'undefined' || !window.speechSynthesis) return undefined;
  const voices = window.speechSynthesis.getVoices() || [];
  const wantedLang = (langHint || '').trim().toLowerCase();
  if (wantedLang) {
    const exact = voices.find((v) => (v.lang || '').toLowerCase() === wantedLang);
    if (exact) return exact;
    const prefix = wantedLang.split('-')[0];
    const byPrefix = voices
      .filter((v) => (v.lang || '').toLowerCase().startsWith(prefix))
      .sort((a, b) => {
        const aLocal = a.localService ? 0 : 1;
        const bLocal = b.localService ? 0 : 1;
        if (aLocal !== bLocal) return aLocal - bLocal;
        return (a.name || '').localeCompare(b.name || '');
      });
    if (byPrefix.length) return byPrefix[0];
    // Māori often unavailable — NZ English is the best local accent fallback.
    if (prefix === 'mi') {
      const enNz = voices.find((v) => (v.lang || '').toLowerCase().startsWith('en-nz'));
      if (enNz) return enNz;
    }
  }
  const wanted = (voiceURI || '').trim();
  if (wanted) {
    const exact = voices.find((v) => v.voiceURI === wanted || v.name === wanted);
    if (exact) return exact;
  }
  const ranked = listBrowserSpeechVoices();
  if (!ranked.length) return voices[0];
  return voices.find((v) => v.voiceURI === ranked[0].voiceURI) ?? voices[0];
}

/** Chrome/Edge silently fail long or post-cancel utterances — speak in short chunks. */
function splitSpeakableChunks(text: string): string[] {
  const cleaned = text.replace(/\s+/g, ' ').trim();
  if (!cleaned) return [];
  const softMax = 180;
  const parts = cleaned.split(/(?<=[.!?])\s+/);
  const chunks: string[] = [];
  let buf = '';
  for (const part of parts) {
    const next = buf ? `${buf} ${part}` : part;
    if (next.length > softMax && buf) {
      chunks.push(buf);
      buf = part;
    } else {
      buf = next;
    }
  }
  if (buf) chunks.push(buf);
  // Hard-split any remaining oversized chunk.
  const out: string[] = [];
  for (const c of chunks) {
    if (c.length <= softMax * 2) {
      out.push(c);
      continue;
    }
    for (let i = 0; i < c.length; i += softMax) {
      out.push(c.slice(i, i + softMax).trim());
    }
  }
  return out.filter(Boolean);
}

function speakWithBrowser(
  text: string,
  onStateChange?: (state: SpeechOutputState) => void,
  voiceURI?: string,
  langHint?: string,
  settleMs = 80
): void {
  if (typeof window === 'undefined' || !window.speechSynthesis) return;
  const chunks = splitSpeakableChunks(text);
  if (!chunks.length) return;

  const token = ++browserSpeakToken;
  const lang = (langHint || '').trim();
  const voice = resolveBrowserVoice(voiceURI, lang);

  const speakChunk = (index: number): void => {
    if (token !== browserSpeakToken) return;
    if (index >= chunks.length) {
      onStateChange?.('idle');
      return;
    }
    const utter = new SpeechSynthesisUtterance(chunks[index]);
    if (voice) {
      utter.voice = voice;
      utter.lang = lang || voice.lang || 'en-NZ';
    } else {
      utter.lang = lang || 'en-NZ';
    }
    utter.rate = 0.95;
    utter.pitch = 1;
    if (index === 0) {
      utter.onstart = () => {
        if (token === browserSpeakToken) onStateChange?.('speaking');
      };
    }
    utter.onpause = () => {
      if (token === browserSpeakToken) onStateChange?.('paused');
    };
    utter.onresume = () => {
      if (token === browserSpeakToken) onStateChange?.('speaking');
    };
    utter.onend = () => {
      if (token !== browserSpeakToken) return;
      speakChunk(index + 1);
    };
    utter.onerror = () => {
      // "interrupted" fires on cancel — ignore unless this token is still active.
      if (token !== browserSpeakToken) return;
      onStateChange?.('idle');
    };

    try {
      // Chrome can stick in paused after cancel(); resume before speak.
      if (window.speechSynthesis.paused) window.speechSynthesis.resume();
      window.speechSynthesis.speak(utter);
      // iOS sometimes stays paused after cancel — nudge resume while speaking.
      if (isAppleTouchBrowser() && index === 0) {
        window.setTimeout(() => {
          if (token !== browserSpeakToken) return;
          try {
            if (window.speechSynthesis.paused) window.speechSynthesis.resume();
          } catch {
            /* ignore */
          }
        }, 250);
      }
    } catch {
      if (token === browserSpeakToken) onStateChange?.('idle');
    }
  };

  // Desktop Chrome/Edge: cancel()+immediate speak is dropped — settle first.
  // iOS/iPadOS: any delay after the tap loses user-gesture and TTS silently fails.
  const delay = isAppleTouchBrowser() ? 0 : Math.max(0, settleMs);
  if (delay === 0) {
    speakChunk(0);
    return;
  }
  window.setTimeout(() => {
    if (token !== browserSpeakToken) return;
    speakChunk(0);
  }, delay);
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
  const wasBusy = speechSynthesisBusy() || Boolean(activeAudio);
  stateListener = onStateChange;
  stopSpeechOutput();
  stateListener = onStateChange;

  const engine: SpeechEngine = options?.speechEngine === 'elevenlabs' ? 'elevenlabs' : 'browser';
  const key = (options?.elevenLabsApiKey || '').trim();
  const browserVoiceURI = (options?.browserVoiceURI || '').trim();
  const lang = (options?.lang || '').trim();
  const settleMs = wasBusy ? 80 : 0;

  if (engine === 'elevenlabs' && key && !lang) {
    onStateChange?.('speaking');
    void speakWithElevenLabs(t, key, (options?.elevenLabsVoiceId || '').trim(), onStateChange).catch(() => {
      speakWithBrowser(t, onStateChange, browserVoiceURI, lang, settleMs);
    });
    return;
  }

  // Prefer browser TTS with a matching language voice for native-language phrases.
  speakWithBrowser(t, onStateChange, lang ? undefined : browserVoiceURI, lang, settleMs);
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
