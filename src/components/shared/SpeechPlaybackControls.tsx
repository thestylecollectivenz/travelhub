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
        <button type="button" className={buttonClassName} onClick={onPause} aria-label="Pause read out" title="Pause">
          &#10074;&#10074;
        </button>
      ) : (
        <button type="button" className={buttonClassName} onClick={onResume} aria-label="Resume read out" title="Resume">
          &#9654;
        </button>
      )}
      <button type="button" className={buttonClassName} onClick={onStop} aria-label="Stop read out" title="Stop">
        &#9632;
      </button>
    </div>
  );
};
