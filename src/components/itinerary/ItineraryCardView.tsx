import * as React from 'react';
import type { ItineraryEntry, ItinerarySubItem } from '../../models/ItineraryEntry';
import { useTripWorkspace } from '../../context/TripWorkspaceContext';
import { CategoryIcon } from '../shared/CategoryIcon';
import { getCategorySlug } from '../../utils/categoryUtils';
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

function emptySubItem(): ItinerarySubItem {
  return {
    id: `sub-${Date.now()}`,
    title: '',
    decisionStatus: 'Idea',
    paymentStatus: 'Not paid',
    amount: 0,
    currency: 'NZD'
  };
}

function ClockIcon(): React.ReactElement {
  return (
    <svg width={12} height={12} viewBox="0 0 16 16" fill="none" aria-hidden>
      <circle cx="8" cy="8" r="5.5" stroke="currentColor" strokeWidth="1.5" />
      <path d="M8 5v3l2 1.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
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
  const { addSubItem, convertToNZD } = useTripWorkspace();
  const [menuOpen, setMenuOpen] = React.useState(false);
  const [notesOpen, setNotesOpen] = React.useState(false);
  const [subItemsOpen, setSubItemsOpen] = React.useState(false);
  const [addingSubItem, setAddingSubItem] = React.useState(false);
  const [newSub, setNewSub] = React.useState<ItinerarySubItem>(emptySubItem);
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

  const displayAmountNZD = convertToNZD(entry.amount, entry.currency || 'NZD');
  const displayAmountPaidNZD = entry.amountPaid !== undefined
    ? convertToNZD(entry.amountPaid, entry.currency || 'NZD')
    : undefined;
  const hhmm = formatTimeHHMM(entry.timeStart);
  // Guard: if duration is a bare number (legacy Number column value) hide it
  const durationDisplay = (() => {
    const d = entry.duration?.trim() ?? '';
    if (!d) return '';
    // If it's purely numeric (old Number column artifact) suppress it
    if (/^\d+(\.\d+)?$/.test(d)) return '';
    return d;
  })();

  const timeChip =
    hhmm !== ''
      ? `${hhmm}${durationDisplay ? ` · ${durationDisplay}` : ''}`
      : durationDisplay || null;

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
    entry.paymentStatus === 'Free'
      ? styles.paymentFree
      : entry.paymentStatus === 'Fully paid'
      ? styles.paymentPaid
      : entry.paymentStatus === 'Part paid'
        ? styles.paymentPart
        : styles.paymentUnpaid;
  const categorySlug = getCategorySlug(entry.category);
  const subItems = entry.subItems ?? [];
  const hasSubItems = subItems.length > 0;
  const subPaid = subItems.reduce((sum, s) => {
    if (s.paymentStatus === 'Fully paid') {
      return sum + s.amount;
    }
    if (s.paymentStatus === 'Part paid') {
      return sum + (s.amountPaid ?? 0);
    }
    return sum;
  }, 0);
  const subTotal = subItems.reduce((sum, s) => sum + s.amount, 0);
  const subOwing = subTotal - subPaid;
  const hasSubTotal = subTotal > 0;
  const showSubItemContent = hasSubItems || addingSubItem;

  const handleStartAddSubItem = React.useCallback(() => {
    setSubItemsOpen(true);
    setAddingSubItem(true);
    setNewSub(emptySubItem());
  }, []);

  const handleSaveNewSubItem = React.useCallback(() => {
    const title = newSub.title.trim();
    if (!title) {
      return;
    }
    addSubItem(entry.id, {
      ...newSub,
      title
    });
    setNewSub(emptySubItem());
    setAddingSubItem(false);
    setSubItemsOpen(true);
  }, [addSubItem, entry.id, newSub]);

  return (
    <div>
      <div className={styles.header}>
        <div className={styles.headerLeft}>
          {timeChip ? (
            <span className={styles.timeChip}>
              <ClockIcon />
              {timeChip}
            </span>
          ) : null}
          <span className={`${styles.categoryBadge} th-cat-${categorySlug} th-cat-badge`}>
            <CategoryIcon category={entry.category} size={12} color="currentColor" />
            {entry.category}
          </span>
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
        <span className={`${styles.statusPill} ${styles.decisionPill} ${decisionClass}`}>{entry.decisionStatus}</span>
        <span className={`${styles.statusPill} ${styles.paymentPill} ${paymentClass}`}>{entry.paymentStatus}</span>
        {entry.bookingRequired ? (
          <span className={`${styles.statusPill} ${styles.bookingPill} ${styles.booking}`}>
            {entry.bookingStatus}
          </span>
        ) : null}
      </div>

      <div className={styles.amountRow}>
        {formatNZD(displayAmountNZD)}
        {entry.currency && entry.currency !== 'NZD' ? (
          <span className={styles.unitSuffix}> ({entry.amount.toLocaleString('en-NZ', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} {entry.currency})</span>
        ) : null}
        {unitSuffix ? <span className={styles.unitSuffix}>{unitSuffix}</span> : null}
      </div>
      {entry.paymentStatus === 'Part paid' && entry.amountPaid !== undefined && displayAmountPaidNZD !== undefined ? (
        <div className={styles.partPaidDetail}>
          <span className={styles.partPaidPaid}>{formatNZD(displayAmountPaidNZD)} paid</span>
          <span className={styles.partPaidSep}> · </span>
          <span className={styles.partPaidOwing}>{formatNZD(displayAmountNZD - displayAmountPaidNZD)} owing</span>
        </div>
      ) : null}
      {hasSubTotal ? (
        <div className={styles.subTotalLine}>
          <span className={styles.subTotalLabel}>incl. options</span>
          <span className={styles.subTotalAmount}>{formatNZD(entry.amount + subTotal)}</span>
          {subPaid > 0 || subOwing > 0 ? (
            <span className={styles.subTotalSplit}>
              <span className={styles.subPaid}>{formatNZD(subPaid)} paid</span>
              {subOwing > 0 ? <span className={styles.subOwing}> · {formatNZD(subOwing)} owing</span> : null}
            </span>
          ) : null}
        </div>
      ) : null}

      {entry.notes.trim() ? (
        <>
          <button type="button" className={styles.notesToggle} onClick={() => setNotesOpen((o) => !o)}>
            {notesOpen ? 'Notes ▴' : 'Notes ▾'}
          </button>
          {notesOpen ? <div className={styles.notesBody}>{entry.notes}</div> : null}
        </>
      ) : null}

      <button type="button" className={styles.addSubItemBtn} onClick={handleStartAddSubItem}>
        + Add option
      </button>

      {hasSubItems ? (
        <>
          <button type="button" className={styles.relatedToggle} onClick={() => setSubItemsOpen((o) => !o)}>
            {subItemsOpen ? `Hide related items ▴` : `Show ${subItems.length} related items ▾`}
          </button>
        </>
      ) : null}

      {showSubItemContent ? (
        <div className={`${styles.relatedContent} ${subItemsOpen || addingSubItem ? styles.relatedContentOpen : ''}`}>
          <SubItemList subItems={subItems} entryId={entry.id} />
          {addingSubItem ? (
            <div className={styles.newSubItemForm}>
              <input
                className={styles.newSubField}
                type="text"
                placeholder="Option title"
                value={newSub.title}
                onChange={(e) => setNewSub((prev) => ({ ...prev, title: e.target.value }))}
              />
              <div className={styles.newSubRow}>
                <select
                  className={styles.newSubField}
                  value={newSub.decisionStatus}
                  onChange={(e) =>
                    setNewSub((prev) => ({ ...prev, decisionStatus: e.target.value as ItinerarySubItem['decisionStatus'] }))
                  }
                >
                  <option value="Idea">Idea</option>
                  <option value="Planned">Planned</option>
                  <option value="Confirmed">Confirmed</option>
                </select>
                <select
                  className={styles.newSubField}
                  value={newSub.paymentStatus}
                  onChange={(e) => {
                    const value = e.target.value as ItinerarySubItem['paymentStatus'];
                    setNewSub((prev) => ({
                      ...prev,
                      paymentStatus: value,
                      amount: value === 'Free' ? 0 : prev.amount
                    }));
                  }}
                >
                  <option value="Not paid">Not paid</option>
                  <option value="Part paid">Part paid</option>
                  <option value="Fully paid">Fully paid</option>
                  <option value="Free">Free</option>
                </select>
                {newSub.paymentStatus !== 'Free' ? (
                  <input
                    className={styles.newSubField}
                    type="number"
                    min={0}
                    placeholder="Amount"
                    value={newSub.amount}
                    onChange={(e) => setNewSub((prev) => ({ ...prev, amount: Number(e.target.value) || 0 }))}
                  />
                ) : null}
              </div>
              <div className={styles.newSubActions}>
                <button type="button" className={styles.newSubActionBtn} onClick={handleSaveNewSubItem}>
                  Add
                </button>
                <button
                  type="button"
                  className={styles.newSubActionBtn}
                  onClick={() => {
                    setAddingSubItem(false);
                    setNewSub(emptySubItem());
                  }}
                >
                  Cancel
                </button>
              </div>
            </div>
          ) : null}
        </div>
      ) : null}
    </div>
  );
};
