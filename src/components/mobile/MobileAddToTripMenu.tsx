import * as React from 'react';
import type { TripRoleLevel } from '../../models/TripMember';
import type { MobileTab } from './mobileTypes';
import {
  setPendingMobileHomeAdd,
  type MobileHomeAddAction
} from '../../utils/mobileHomePendingAction';
import styles from './MobileHome.module.css';

export interface MobileAddToTripMenuProps {
  tripId?: string;
  role: TripRoleLevel | null;
  onSelectTrip: (tripId: string, initialTab?: MobileTab) => void;
}

interface AddOption {
  action: MobileHomeAddAction;
  label: string;
  tab: MobileTab;
}

const EDITOR_OPTIONS: AddOption[] = [
  { action: 'itinerary_item', label: 'Itinerary item', tab: 'today' },
  { action: 'journal_entry', label: 'Journal entry', tab: 'journal' },
  { action: 'journal_photo', label: 'Photo', tab: 'journal' },
  { action: 'task', label: 'Task', tab: 'tasks' },
  { action: 'packing_item', label: 'Packing item', tab: 'lists' },
  { action: 'shopping_item', label: 'Shopping item', tab: 'lists' },
  { action: 'day_idea', label: 'Day idea', tab: 'lists' }
];

export const MobileAddToTripMenu: React.FC<MobileAddToTripMenuProps> = ({ tripId, role, onSelectTrip }) => {
  const [open, setOpen] = React.useState(false);
  const menuRef = React.useRef<HTMLDivElement | null>(null);

  const canAdd = Boolean(tripId) && (role === 'Editor' || role === 'Companion');
  const options = canAdd ? EDITOR_OPTIONS : [];

  React.useEffect(() => {
    if (!open) return;
    const close = (e: MouseEvent): void => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', close);
    return () => document.removeEventListener('mousedown', close);
  }, [open]);

  const pick = (opt: AddOption): void => {
    if (!tripId) return;
    setPendingMobileHomeAdd(opt.action);
    onSelectTrip(tripId, opt.tab);
    setOpen(false);
  };

  if (!canAdd) return null;

  return (
    <div className={styles.addBannerWrap} ref={menuRef}>
      <button type="button" className={styles.addBanner} onClick={() => setOpen((v) => !v)} aria-expanded={open}>
        <span>Add to trip</span>
        <span className={styles.addPlus} aria-hidden>
          +
        </span>
      </button>
      {open ? (
        <div className={styles.addMenu} role="menu" aria-label="Add to trip">
          {options.map((opt) => (
            <button key={opt.action} type="button" className={styles.addMenuItem} role="menuitem" onClick={() => pick(opt)}>
              {opt.label}
            </button>
          ))}
        </div>
      ) : null}
    </div>
  );
};
