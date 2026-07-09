import * as React from 'react';
import type { SpeechOutputState } from '../../utils/speechVoice';

export interface SpeechPlaybackControlsProps {
  speechState: SpeechOutputState;
  onPause: () => void;
  onResume: () => void;
  onStop: () => void;
  className?: string;
  buttonClassName?: string;
}

export const SpeechPlaybackControls: React.FC<SpeechPlaybackControlsProps> = ({
  speechState,
  onPause,
  onResume,
  onStop,
  className,
  buttonClassName
}) => {
  if (speechState === 'idle') return null;
  return (
    <div className={className}>
      {speechState === 'speaking' ? (
        <button type="button" className={buttonClassName} onClick={onPause}>
          Pause
        </button>
      ) : (
        <button type="button" className={buttonClassName} onClick={onResume}>
          Resume
        </button>
      )}
      <button type="button" className={buttonClassName} onClick={onStop}>
        Stop
      </button>
    </div>
  );
};
