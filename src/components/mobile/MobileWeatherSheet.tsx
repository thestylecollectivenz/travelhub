import * as React from 'react';
import * as ReactDOM from 'react-dom';
import type { Place } from '../../models/Place';
import { useShellMode } from '../../hooks/useShellMode';
import { MobileWeatherContent } from './MobileWeatherContent';
import styles from './MobileWeatherSheet.module.css';

export interface MobileWeatherSheetProps {
  place: Place;
  calendarDate: string;
  travelTip?: string;
  onClose: () => void;
}

export const MobileWeatherSheet: React.FC<MobileWeatherSheetProps> = ({
  place,
  calendarDate,
  travelTip,
  onClose
}) => {
  const shellMode = useShellMode();

  React.useEffect(() => {
    const onKey = (e: KeyboardEvent): void => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  return ReactDOM.createPortal(
    <div className={styles.backdrop} role="presentation" onClick={onClose}>
      <div
        className={styles.sheet}
        role="dialog"
        aria-modal="true"
        aria-label={`Weather for ${place.title}`}
        data-shell={shellMode === 'ipad-portrait' ? 'ipad-portrait' : undefined}
        onClick={(e) => e.stopPropagation()}
      >
        <div className={styles.body}>
          <MobileWeatherContent
            place={place}
            weatherAnchorDate={calendarDate}
            travelTip={travelTip}
            onClose={onClose}
          />
        </div>
      </div>
    </div>,
    document.body
  );
};
