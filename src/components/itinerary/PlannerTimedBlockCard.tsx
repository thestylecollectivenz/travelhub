import * as React from 'react';
import type { EntryDocument, EntryLink } from '../../models';
import type { TripDay } from '../../models/TripDay';
import type { ItineraryEntry, ItinerarySubItem } from '../../models/ItineraryEntry';
import { isTransportReturnOnCalendarDate } from '../../utils/itineraryDayEntries';
import { formatLocationText } from '../../utils/placeDisplayLabel';
import { getCategorySlug } from '../../utils/categoryUtils';
import { openDocumentUrl } from '../../utils/openDocumentUrl';
import type { PlannerTimedItem } from '../../utils/plannerCalendarItems';
import { ItineraryCard } from './ItineraryCard';
import styles from './ItineraryDayPlannerView.module.css';

function DocGlyph(): React.ReactElement {
  return (
    <svg width={10} height={10} viewBox="0 0 16 16" fill="none" aria-hidden>
      <path d="M4 1.5h5l3 3V14.5H4V1.5Z" stroke="currentColor" strokeWidth="1.1" />
      <path d="M9 1.5V5h3" stroke="currentColor" strokeWidth="1.1" />
    </svg>
  );
}

function LinkGlyph(): React.ReactElement {
  return (
    <svg width={10} height={10} viewBox="0 0 16 16" fill="none" aria-hidden>
      <path d="M6 10l4-4M5 5h2M9 11h2" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" />
    </svg>
  );
}

function PencilGlyph(): React.ReactElement {
  return (
    <svg width={10} height={10} viewBox="0 0 16 16" fill="none" aria-hidden>
      <path d="M3 11.8 11.6 3.2l1.2 1.2L4.2 13H3v-1.2Z" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M9.9 4.9 11.1 6.1" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
    </svg>
  );
}

function EyeGlyph(): React.ReactElement {
  return (
    <svg width={10} height={10} viewBox="0 0 16 16" fill="none" aria-hidden>
      <path
        d="M1.5 8s2.5-4.25 6.5-4.25S14.5 8 14.5 8 12 12.25 8 12.25 1.5 8 1.5 8Z"
        stroke="currentColor"
        strokeWidth="1.4"
        strokeLinejoin="round"
      />
      <circle cx="8" cy="8" r="2" stroke="currentColor" strokeWidth="1.4" />
    </svg>
  );
}

function blockLocation(entry: ItineraryEntry, sub?: ItinerarySubItem): string {
  const raw = (sub?.location || entry.location || '').trim();
  if (!raw) return '';
  if (sub || entry.category === 'Activities' || entry.category === 'Other') {
    return formatLocationText(raw);
  }
  return '';
}

export interface PlannerTimedBlockCardProps {
  item: PlannerTimedItem;
  cal: string;
  day: TripDay;
  top: number;
  height: number;
  docs: EntryDocument[];
  links: EntryLink[];
  blockZ: number;
  meta: string;
  cancel?: string;
  editingCardId: string | null;
  onToggleFront: () => void;
  onPreview: () => void;
  onEdit: () => void;
}

export const PlannerTimedBlockCard: React.FC<PlannerTimedBlockCardProps> = ({
  item,
  cal,
  day,
  top,
  height,
  docs,
  links,
  blockZ,
  meta,
  cancel,
  editingCardId,
  onToggleFront,
  onPreview,
  onEdit
}) => {
  const e = item.entry;
  const sub = item.subItem;
  const cat = getCategorySlug(item.category);
  const loc = blockLocation(e, sub);
  const isEditingParent = !sub && editingCardId === e.id;

  return (
    <div
      style={{ position: 'absolute', left: 4, right: 4, top: `${top}px`, height: `${height}px`, zIndex: blockZ }}
      onMouseDown={(ev) => {
        ev.stopPropagation();
        onToggleFront();
      }}
    >
      {isEditingParent ? (
        <div className={styles.editOverlay}>
          <ItineraryCard entry={e} calendarDate={cal} suppressCarryoverUi={day.dayType === 'PreTrip'} draggable={false} useEditPortal />
        </div>
      ) : (
        <div className={`${styles.block} th-cat-${cat} th-cat-border`} style={{ position: 'static', height: '100%' }}>
          <div className={styles.blockTitleRow}>
            <div className={styles.blockTextCol}>
              <div className={styles.blockTitle}>
                {!sub && isTransportReturnOnCalendarDate(e, cal) ? (
                  <span className={styles.returnBadge}>Return</span>
                ) : null}{' '}
                {item.title}
              </div>
              {loc ? <div className={styles.blockLocation}>{loc}</div> : null}
              {sub && item.parentTitle ? <div className={styles.blockParentHint}>{item.parentTitle}</div> : null}
              <div className={styles.blockMeta}>{meta}</div>
            </div>
            <div className={styles.blockActions}>
              <button type="button" className={styles.iconBtn} aria-label="Preview entry" title="Preview" onClick={onPreview}>
                <EyeGlyph />
              </button>
              <button
                type="button"
                className={styles.iconBtn}
                aria-label={sub ? 'Edit option' : 'Edit entry'}
                title="Edit"
                onClick={onEdit}
              >
                <PencilGlyph />
              </button>
            </div>
          </div>
          {cancel ? <div className={styles.blockCancel}>{cancel}</div> : null}
          <div className={styles.blockIcons}>
            {docs.map((d) => (
              <a
                key={d.id}
                href={d.fileUrl}
                target="_blank"
                rel="noopener noreferrer"
                title={d.title}
                onClick={(ev) => {
                  ev.stopPropagation();
                  openDocumentUrl(d.fileUrl);
                }}
              >
                <DocGlyph />
              </a>
            ))}
            {links.map((l) => (
              <a
                key={l.id}
                href={l.url}
                target="_blank"
                rel="noopener noreferrer"
                title={l.linkTitle}
                onClick={(ev) => {
                  ev.stopPropagation();
                  openDocumentUrl(l.url);
                }}
              >
                <LinkGlyph />
              </a>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};
