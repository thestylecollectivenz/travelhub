import * as React from 'react';
import type { ItineraryEntry } from '../../models/ItineraryEntry';
import { formatNZD } from '../../utils/financialUtils';
import { formatTimeHHMM } from '../../utils/itineraryTimeUtils';
import { SubItemList } from './SubItemList';
import styles from './ItineraryCardView.module.css';

export interface ItineraryCardViewProps {
  entry: ItineraryEntry;
  onEdit: () => void;
  onDuplicate: () => void;
  onDelete: () => void;
}

function categoryBadgeClass(category: string): string {
  switch (category) {
    case 'Flights':
      return styles.badgeFlights;
    case 'Accommodation':
      return styles.badgeAccommodation;
    case 'Food & Dining':
      return styles.badgeFood;
    case 'Activities':
      return styles.badgeActivities;
    case 'Transport':
      return styles.badgeTransport;
    default:
      return styles.badgeOther;
  }
}

function PinIcon(): React.ReactElement {
  return (
    <svg className={styles.pin} width={12} height={12} viewBox="0 0 24 24" fill="none" aria-hidden>
      <path
        d="M12 21s7-4.35 7-10a7 7 0 1 0-14 0c0 5.65 7 10 7 10Z"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinejoin="round"
      />
      <circle cx="12" cy="11" r="2" fill="currentColor" />
    </svg>
  );
}

export const ItineraryCardView: React.FC<ItineraryCardViewProps> = ({ entry, onEdit, onDuplicate, onDelete }) => {
  const [menuOpen, setMenuOpen] = React.useState(false);
  const [notesOpen, setNotesOpen] = React.useState(false);
  const [subItemsOpen, setSubItemsOpen] = React.useState(false);
  const menuRef = React.useRef<HTMLDivElement>(null);

  React.useEffect(() => {
    if (!menuOpen) {
      return undefined;
    }
    const onDoc = (ev: MouseEvent): void => {
      const el = menuRef.current;
      if (el && !el.contains(ev.target as Node)) {
        setMenuOpen(false);
      }
    };
    document.addEventListener('mousedown', onDoc);
    return () => document.removeEventListener('mousedown', onDoc);
  }, [menuOpen]);

  const hhmm = formatTimeHHMM(entry.timeStart);
  const timeChip =
    hhmm !== ''
      ? `${hhmm}${entry.duration.trim() ? ` · ${entry.duration}` : ''}`
      : entry.duration.trim()
        ? entry.duration
        : null;

  const supplier = entry.supplier.trim();
  const location = (entry.location ?? '').trim();

  let unitSuffix = '';
  if (entry.unitType && typeof entry.unitAmount === 'number' && !Number.isNaN(entry.unitAmount)) {
    const amt = formatNZD(entry.unitAmount);
    if (entry.unitType === 'PerPerson') {
      unitSuffix = ` · ${amt} pp`;
    } else if (entry.unitType === 'PerNight') {
      unitSuffix = ` · ${amt} /night`;
    } else if (entry.unitType === 'PerDay') {
      unitSuffix = ` · ${amt} /day`;
    }
  }

  const decisionClass =
    entry.decisionStatus === 'Idea'
      ? styles.decisionIdea
      : entry.decisionStatus === 'Planned'
        ? styles.decisionPlanned
        : styles.decisionConfirmed;

  const paymentClass =
    entry.paymentStatus === 'Fully paid'
      ? styles.paymentPaid
      : entry.paymentStatus === 'Part paid'
        ? styles.paymentPart
        : styles.paymentUnpaid;
  const subItems = entry.subItems ?? [];
  const hasSubItems = subItems.length > 0;

  return (
    <div>
      <div className={styles.header}>
        <div className={styles.headerLeft}>
          {timeChip ? <span className={styles.timeChip}>{timeChip}</span> : null}
          <span className={`${styles.categoryBadge} ${categoryBadgeClass(entry.category)}`}>{entry.category}</span>
        </div>
        <div className={styles.menuWrap} ref={menuRef}>
          <button
            type="button"
            className={styles.menuButton}
            aria-expanded={menuOpen}
            aria-haspopup="menu"
            aria-label="Entry actions"
            onClick={() => setMenuOpen((o) => !o)}
          >
            ⋯
          </button>
          {menuOpen ? (
            <div className={styles.dropdown} role="menu">
              <button
                type="button"
                role="menuitem"
                onClick={() => {
                  setMenuOpen(false);
                  onEdit();
                }}
              >
                Edit
              </button>
              <button
                type="button"
                role="menuitem"
                onClick={() => {
                  setMenuOpen(false);
                  onDuplicate();
                }}
              >
                Duplicate
              </button>
              <button
                type="button"
                role="menuitem"
                onClick={() => {
                  setMenuOpen(false);
                  onDelete();
                }}
              >
                Delete
              </button>
            </div>
          ) : null}
        </div>
      </div>

      <h3 className={styles.title}>{entry.title || 'Untitled'}</h3>

      {supplier || location ? (
        <div className={styles.metaRow}>
          {supplier ? <span>{supplier}</span> : null}
          {supplier && location ? <span aria-hidden> · </span> : null}
          {location ? (
            <span>
              <PinIcon />
              {location}
            </span>
          ) : null}
        </div>
      ) : null}

      <div className={styles.badges}>
        <span className={`${styles.statusPill} ${decisionClass}`}>{entry.decisionStatus}</span>
        <span className={`${styles.statusPill} ${paymentClass}`}>{entry.paymentStatus}</span>
        {entry.bookingRequired ? (
          <span
            className={`${styles.statusPill} ${
              entry.bookingStatus === 'Booked' ? styles.booking : styles.bookingPending
            }`}
          >
            {entry.bookingStatus}
          </span>
        ) : null}
      </div>

      <div className={styles.amountRow}>
        {formatNZD(entry.amount)}
        {unitSuffix ? <span className={styles.unitSuffix}>{unitSuffix}</span> : null}
      </div>

      {entry.notes.trim() ? (
        <>
          <button type="button" className={styles.notesToggle} onClick={() => setNotesOpen((o) => !o)}>
            {notesOpen ? 'Notes ▴' : 'Notes ▾'}
          </button>
          {notesOpen ? <div className={styles.notesBody}>{entry.notes}</div> : null}
        </>
      ) : null}

      {hasSubItems ? (
        <>
          <button type="button" className={styles.relatedToggle} onClick={() => setSubItemsOpen((o) => !o)}>
            {subItemsOpen ? `Hide related items ▴` : `Show ${subItems.length} related items ▾`}
          </button>
          <div className={`${styles.relatedContent} ${subItemsOpen ? styles.relatedContentOpen : ''}`}>
            <SubItemList subItems={subItems} />
          </div>
        </>
      ) : null}
    </div>
  );
};
