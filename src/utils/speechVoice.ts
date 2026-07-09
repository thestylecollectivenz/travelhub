import {
  DEFAULT_ELEVENLABS_VOICE_ID,
  synthesizeElevenLabsSpeech
} from '../services/ElevenLabsService';

export type SpeechOutputState = 'idle' | 'speaking' | 'paused';

export interface SpeakOptions {
  elevenLabsApiKey?: string;
  elevenLabsVoiceId?: string;
  preferElevenLabs?: boolean;
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

function speakWithBrowser(text: string, onStateChange?: (state: SpeechOutputState) => void): void {
  if (typeof window === 'undefined' || !window.speechSynthesis) return;
  const utter = new SpeechSynthesisUtterance(text);
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
 * Prefer ElevenLabs when an API key is configured; otherwise browser speechSynthesis.
 * Falls back to browser speech if ElevenLabs fails (quota, network, invalid key).
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

  const key = (options?.elevenLabsApiKey || '').trim();
  const prefer = options?.preferElevenLabs !== false;
  if (prefer && key) {
    onStateChange?.('speaking');
    void speakWithElevenLabs(t, key, (options?.elevenLabsVoiceId || '').trim(), onStateChange).catch(() => {
      speakWithBrowser(t, onStateChange);
    });
    return;
  }

  speakWithBrowser(t, onStateChange);
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
