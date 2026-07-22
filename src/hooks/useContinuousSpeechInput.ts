import * as React from 'react';
import { collectFinalTranscript, getSpeechRecognitionCtor, type SpeechRecognitionResultEvent } from '../utils/speechVoice';

export function useContinuousSpeechInput(onFinalChunk: (transcript: string) => void): {
  listening: boolean;
  supported: boolean;
  startListening: () => void;
  stopListening: () => void;
  toggleListening: () => void;
} {
  const [listening, setListening] = React.useState(false);
  const activeRef = React.useRef(false);
  const recognitionRef = React.useRef<InstanceType<NonNullable<ReturnType<typeof getSpeechRecognitionCtor>>> | null>(
    null
  );
  const onFinalChunkRef = React.useRef(onFinalChunk);
  onFinalChunkRef.current = onFinalChunk;

  const stopListening = React.useCallback(() => {
    activeRef.current = false;
    setListening(false);
    const recognition = recognitionRef.current;
    recognitionRef.current = null;
    try {
      recognition?.stop();
    } catch {
      /* ignore */
    }
  }, []);

  const startRecognition = React.useCallback(() => {
    const Ctor = getSpeechRecognitionCtor();
    if (!Ctor) return false;
    const recognition = new Ctor();
    recognition.lang = 'en-NZ';
    recognition.continuous = true;
    recognition.interimResults = true;
    recognition.maxAlternatives = 1;
    recognitionRef.current = recognition;

    recognition.onresult = (event: SpeechRecognitionResultEvent): void => {
      const chunk = collectFinalTranscript(event);
      if (chunk) onFinalChunkRef.current(chunk);
    };
    recognition.onerror = (): void => {
      if (!activeRef.current) return;
      stopListening();
    };
    recognition.onend = (): void => {
      if (!activeRef.current) {
        setListening(false);
        return;
      }
      try {
        recognition.start();
      } catch {
        setListening(false);
        activeRef.current = false;
      }
    };
    try {
      recognition.start();
      return true;
    } catch {
      recognitionRef.current = null;
      return false;
    }
  }, [stopListening]);

  const startListening = React.useCallback(() => {
    if (activeRef.current) return;
    activeRef.current = true;
    setListening(true);
    if (!startRecognition()) {
      activeRef.current = false;
      setListening(false);
    }
  }, [startRecognition]);

  const toggleListening = React.useCallback(() => {
    if (activeRef.current) stopListening();
    else startListening();
  }, [startListening, stopListening]);

  React.useEffect(() => () => stopListening(), [stopListening]);

  const supported = Boolean(getSpeechRecognitionCtor());
  return { listening, supported, startListening, stopListening, toggleListening };
}
