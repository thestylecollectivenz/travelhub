import * as React from 'react';
import * as ReactDOM from 'react-dom';
import type { ItineraryEntry } from '../../models/ItineraryEntry';
import { useTripWorkspace } from '../../context/TripWorkspaceContext';
import { useTripPermissions } from '../../hooks/useTripPermissions';
import { compactPlaceLabel } from '../../utils/placeDisplayLabel';
import { parseLocationInfoNotes } from '../../utils/locationInfoEntry';
import { usePlaces } from '../../context/PlacesContext';
import { LocationInfoPanelContent } from './LocationInfoPanelContent';
import { ItineraryCardEdit } from './ItineraryCardEdit';
import cardStyles from './ItineraryCard.module.css';
import styles from './LocationInfoSlidePanel.module.css';

const PANEL_SIZE_STORAGE_KEY = 'travelhub-location-info-panel-size';
const DEFAULT_WIDTH = 544;
const DEFAULT_HEIGHT = 640;
const MIN_WIDTH = 320;
const MIN_HEIGHT = 360;

interface PanelSize {
  width: number;
  height: number;
}

function clampPanelSize(size: PanelSize): PanelSize {
  if (typeof window === 'undefined') return size;
  return {
    width: Math.min(Math.max(MIN_WIDTH, size.width), Math.max(MIN_WIDTH, window.innerWidth - 24)),
    height: Math.min(Math.max(MIN_HEIGHT, size.height), Math.max(MIN_HEIGHT, Math.floor(window.innerHeight * 0.9)))
  };
}

function loadPanelSize(): PanelSize {
  if (typeof window === 'undefined') return { width: DEFAULT_WIDTH, height: DEFAULT_HEIGHT };
  try {
    const raw = window.localStorage.getItem(PANEL_SIZE_STORAGE_KEY);
    if (!raw) return clampPanelSize({ width: DEFAULT_WIDTH, height: DEFAULT_HEIGHT });
    const parsed = JSON.parse(raw) as Partial<PanelSize>;
    if (typeof parsed.width === 'number' && typeof parsed.height === 'number') {
      return clampPanelSize({ width: parsed.width, height: parsed.height });
    }
  } catch {
    /* ignore */
  }
  return clampPanelSize({ width: DEFAULT_WIDTH, height: DEFAULT_HEIGHT });
}

export interface LocationInfoSlidePanelProps {
  entry: ItineraryEntry | null;
  calendarDate: string;
  onClose: () => void;
}

export const LocationInfoSlidePanel: React.FC<LocationInfoSlidePanelProps> = ({ entry, calendarDate, onClose }) => {
  const { editingCardId, setEditingCardId, updateEntry } = useTripWorkspace();
  const { canEditItinerary, canUseAiHelpers } = useTripPermissions();
  const { placeById } = usePlaces();
  const [panelSize, setPanelSize] = React.useState<PanelSize>(() => loadPanelSize());
  const resizeRef = React.useRef<{
    pointerId: number;
    startX: number;
    startY: number;
    originWidth: number;
    originHeight: number;
  } | null>(null);

  React.useEffect(() => {
    if (!entry) return undefined;
    const onKey = (ev: KeyboardEvent): void => {
      if (ev.key === 'Escape' && editingCardId !== entry.id) onClose();
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [entry, onClose, editingCardId]);

  React.useEffect(() => {
    const onResize = (): void => setPanelSize((prev) => clampPanelSize(prev));
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, []);

  if (!entry || typeof document === 'undefined') return null;

  const data = parseLocationInfoNotes(entry.notes);
  const place = data ? placeById(data.placeId) : undefined;
  const title = place
    ? compactPlaceLabel(place.title, place.country)
    : (entry.title || entry.location || 'Location').trim() || 'Location';
  const isEditing = canEditItinerary && editingCardId === entry.id;

  const onResizePointerDown = (e: React.PointerEvent<HTMLDivElement>): void => {
    if (e.button !== 0) return;
    e.preventDefault();
    e.stopPropagation();
    resizeRef.current = {
      pointerId: e.pointerId,
      startX: e.clientX,
      startY: e.clientY,
      originWidth: panelSize.width,
      originHeight: panelSize.height
    };
    e.currentTarget.setPointerCapture(e.pointerId);
  };

  const onResizePointerMove = (e: React.PointerEvent<HTMLDivElement>): void => {
    const resize = resizeRef.current;
    if (!resize || resize.pointerId !== e.pointerId) return;
    setPanelSize(
      clampPanelSize({
        width: resize.originWidth + (e.clientX - resize.startX),
        height: resize.originHeight + (e.clientY - resize.startY)
      })
    );
  };

  const onResizePointerUp = (e: React.PointerEvent<HTMLDivElement>): void => {
    const resize = resizeRef.current;
    if (!resize || resize.pointerId !== e.pointerId) return;
    const finalSize = clampPanelSize({
      width: resize.originWidth + (e.clientX - resize.startX),
      height: resize.originHeight + (e.clientY - resize.startY)
    });
    resizeRef.current = null;
    if (e.currentTarget.hasPointerCapture(e.pointerId)) {
      e.currentTarget.releasePointerCapture(e.pointerId);
    }
    setPanelSize(finalSize);
    try {
      window.localStorage.setItem(PANEL_SIZE_STORAGE_KEY, JSON.stringify(finalSize));
    } catch {
      /* ignore */
    }
  };

  if (isEditing) {
    return ReactDOM.createPortal(
      <div className={cardStyles.portalEditRoot} role="presentation">
        <div className={cardStyles.portalEditInner}>
          <ItineraryCardEdit
            key={entry.id}
            entry={entry}
            calendarDate={calendarDate}
            onSave={(saved) => {
              updateEntry(saved);
              setEditingCardId(null);
            }}
            onCancel={() => setEditingCardId(null)}
            onDelete={() => {
              setEditingCardId(null);
              onClose();
            }}
          />
        </div>
      </div>,
      document.body
    );
  }

  const panel = (
    <div className={styles.backdrop} role="presentation" onClick={onClose}>
      <div
        className={styles.dialog}
        style={{ width: panelSize.width, height: panelSize.height }}
        role="dialog"
        aria-modal="true"
        aria-label={`Location info — ${title}`}
        onClick={(e) => e.stopPropagation()}
      >
        <header className={styles.header}>
          <h2 className={styles.title}>{title}</h2>
          <div className={styles.headerActions}>
            {canEditItinerary ? (
              <button type="button" className={styles.headerBtn} onClick={() => setEditingCardId(entry.id)}>
                Edit
              </button>
            ) : null}
            <button type="button" className={styles.closeBtn} aria-label="Close" onClick={onClose}>
              ×
            </button>
          </div>
        </header>
        <div className={styles.body}>
          <LocationInfoPanelContent entry={entry} readOnly={!canUseAiHelpers} />
        </div>
        <div
          className={styles.resizeHandle}
          role="separator"
          aria-label="Resize location info panel"
          title="Drag to resize"
          onPointerDown={onResizePointerDown}
          onPointerMove={onResizePointerMove}
          onPointerUp={onResizePointerUp}
          onPointerCancel={onResizePointerUp}
        />
      </div>
    </div>
  );

  return ReactDOM.createPortal(panel, document.body);
};
