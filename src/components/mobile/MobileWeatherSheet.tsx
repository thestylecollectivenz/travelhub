import * as React from 'react';
import * as ReactDOM from 'react-dom';
import type { Place } from '../../models/Place';
import { PlaceInfoPanel } from '../day/PlaceInfoPanel';
import styles from './MobileLocationInfo.module.css';

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
        onClick={(e) => e.stopPropagation()}
      >
        <header className={styles.header}>
          <h2 className={styles.title}>Weather &amp; tips</h2>
          <button type="button" className={styles.closeBtn} onClick={onClose} aria-label="Close">
            ×
          </button>
        </header>
        <div className={styles.body}>
          <PlaceInfoPanel
            place={place}
            weatherAnchorDate={calendarDate}
            forecastDates={[calendarDate.slice(0, 10)]}
            showHeader
          />
          {travelTip ? <p className={styles.travelTip}>{travelTip}</p> : null}
        </div>
      </div>
    </div>,
    document.body
  );
};
