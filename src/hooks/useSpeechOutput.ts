import * as React from 'react';
import {
  getSpeechOutputState,
  pauseSpeechOutput,
  resumeSpeechOutput,
  speakPlainText,
  stopSpeechOutput,
  type SpeechOutputState
} from '../utils/speechVoice';

export function useSpeechOutput(): {
  speechState: SpeechOutputState;
  speak: (text: string) => void;
  pause: () => void;
  resume: () => void;
  stop: () => void;
} {
  const [speechState, setSpeechState] = React.useState<SpeechOutputState>('idle');

  React.useEffect(() => {
    const tick = (): void => setSpeechState(getSpeechOutputState());
    const id = window.setInterval(tick, 400);
    return () => window.clearInterval(id);
  }, []);

  const speak = React.useCallback((text: string) => {
    speakPlainText(text, setSpeechState);
  }, []);

  const pause = React.useCallback(() => {
    if (pauseSpeechOutput()) setSpeechState('paused');
  }, []);

  const resume = React.useCallback(() => {
    if (resumeSpeechOutput()) setSpeechState('speaking');
  }, []);

  const stop = React.useCallback(() => {
    stopSpeechOutput();
    setSpeechState('idle');
  }, []);

  return { speechState, speak, pause, resume, stop };
}
