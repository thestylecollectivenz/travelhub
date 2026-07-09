export type SpeechOutputState = 'idle' | 'speaking' | 'paused';

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

export function getSpeechRecognitionCtor(): SpeechRecognitionCtor | undefined {
  if (typeof window === 'undefined') return undefined;
  const w = window as Window & {
    SpeechRecognition?: SpeechRecognitionCtor;
    webkitSpeechRecognition?: SpeechRecognitionCtor;
  };
  return w.SpeechRecognition || w.webkitSpeechRecognition;
}

export function stopSpeechOutput(): void {
  if (typeof window === 'undefined' || !window.speechSynthesis) return;
  window.speechSynthesis.cancel();
}

export function pauseSpeechOutput(): boolean {
  if (typeof window === 'undefined' || !window.speechSynthesis) return false;
  if (!window.speechSynthesis.speaking || window.speechSynthesis.paused) return false;
  window.speechSynthesis.pause();
  return true;
}

export function resumeSpeechOutput(): boolean {
  if (typeof window === 'undefined' || !window.speechSynthesis) return false;
  if (!window.speechSynthesis.paused) return false;
  window.speechSynthesis.resume();
  return true;
}

export function getSpeechOutputState(): SpeechOutputState {
  if (typeof window === 'undefined' || !window.speechSynthesis) return 'idle';
  if (window.speechSynthesis.paused) return 'paused';
  if (window.speechSynthesis.speaking) return 'speaking';
  return 'idle';
}

export function speakPlainText(
  text: string,
  onStateChange?: (state: SpeechOutputState) => void
): void {
  if (typeof window === 'undefined' || !window.speechSynthesis) return;
  const t = (text || '').trim();
  if (!t) return;
  stopSpeechOutput();
  const utter = new SpeechSynthesisUtterance(t);
  utter.onstart = () => onStateChange?.('speaking');
  utter.onpause = () => onStateChange?.('paused');
  utter.onresume = () => onStateChange?.('speaking');
  utter.onend = () => onStateChange?.('idle');
  utter.onerror = () => onStateChange?.('idle');
  window.speechSynthesis.speak(utter);
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
