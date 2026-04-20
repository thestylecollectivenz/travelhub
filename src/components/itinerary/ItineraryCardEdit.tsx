import * as React from 'react';
import type { ItineraryEntry } from '../../models/ItineraryEntry';
import { BUDGET_CATEGORY_ORDER } from '../../utils/financialUtils';
import { combineDayAndTime, formatTimeHHMM } from '../../utils/itineraryTimeUtils';
import styles from './ItineraryCardEdit.module.css';

export interface ItineraryCardEditProps {
  entry: ItineraryEntry;
  calendarDate: string;
  onSave: (entry: ItineraryEntry) => void;
  onCancel: () => void;
  onDelete: () => void;
}

export const ItineraryCardEdit: React.FC<ItineraryCardEditProps> = ({
  entry,
  calendarDate,
  onSave,
  onCancel,
  onDelete
}) => {
  const [draft, setDraft] = React.useState<ItineraryEntry>(() => ({ ...entry }));

  const timeValue = formatTimeHHMM(draft.timeStart);

  const patch = React.useCallback((partial: Partial<ItineraryEntry>) => {
    setDraft((d) => ({ ...d, ...partial }));
  }, []);

  const handleSave = React.useCallback(() => {
    const title = draft.title.trim();
    if (!title) {
      return;
    }
    const cur = draft.currency.trim().toUpperCase().slice(0, 3) || 'NZD';
    const timeStart = combineDayAndTime(calendarDate, timeValue);
    const saved: ItineraryEntry = {
      ...draft,
      title,
      currency: cur,
      timeStart: timeStart || '',
      supplier: draft.supplier.trim(),
      notes: draft.notes.trim(),
      location: draft.location?.trim() || undefined,
      duration: draft.duration.trim()
    };
    onSave(saved);
  }, [calendarDate, draft, timeValue]);

  const canSave = draft.title.trim().length > 0;

  return (
    <div className={styles.form}>
      <div className={styles.grid}>
        <label className={styles.label} htmlFor={`time-${draft.id}`}>
          Time
        </label>
        <input
          id={`time-${draft.id}`}
          className={styles.input}
          type="time"
          value={timeValue}
          onChange={(e) => patch({ timeStart: combineDayAndTime(calendarDate, e.target.value) })}
        />

        <label className={styles.label} htmlFor={`dur-${draft.id}`}>
          Duration
        </label>
        <input
          id={`dur-${draft.id}`}
          className={styles.input}
          type="text"
          placeholder="e.g. 2h 30m"
          value={draft.duration}
          onChange={(e) => patch({ duration: e.target.value })}
        />

        <label className={styles.label} htmlFor={`title-${draft.id}`}>
          Title
        </label>
        <input
          id={`title-${draft.id}`}
          className={styles.input}
          type="text"
          required
          value={draft.title}
          onChange={(e) => patch({ title: e.target.value })}
        />

        <label className={styles.label} htmlFor={`cat-${draft.id}`}>
          Category
        </label>
        <select
          id={`cat-${draft.id}`}
          className={styles.select}
          value={draft.category}
          onChange={(e) => patch({ category: e.target.value })}
        >
          {BUDGET_CATEGORY_ORDER.map((c) => (
            <option key={c} value={c}>
              {c}
            </option>
          ))}
        </select>

        <label className={styles.label} htmlFor={`sup-${draft.id}`}>
          Supplier
        </label>
        <input
          id={`sup-${draft.id}`}
          className={styles.input}
          type="text"
          value={draft.supplier}
          onChange={(e) => patch({ supplier: e.target.value })}
        />

        <label className={styles.label} htmlFor={`loc-${draft.id}`}>
          Location
        </label>
        <input
          id={`loc-${draft.id}`}
          className={styles.input}
          type="text"
          value={draft.location ?? ''}
          onChange={(e) => patch({ location: e.target.value })}
        />

        <label className={`${styles.label} ${styles.fullRow}`} htmlFor={`notes-${draft.id}`}>
          Notes
        </label>
        <textarea
          id={`notes-${draft.id}`}
          className={`${styles.textarea} ${styles.fullRow}`}
          rows={3}
          value={draft.notes}
          onChange={(e) => patch({ notes: e.target.value })}
        />

        <label className={styles.label} htmlFor={`dec-${draft.id}`}>
          Decision
        </label>
        <select
          id={`dec-${draft.id}`}
          className={styles.select}
          value={draft.decisionStatus}
          onChange={(e) =>
            patch({ decisionStatus: e.target.value as ItineraryEntry['decisionStatus'] })
          }
        >
          <option value="Idea">Idea</option>
          <option value="Planned">Planned</option>
          <option value="Confirmed">Confirmed</option>
        </select>

        <div className={`${styles.checkboxRow} ${styles.fullRow}`}>
          <input
            id={`bookreq-${draft.id}`}
            className={styles.checkbox}
            type="checkbox"
            checked={draft.bookingRequired}
            onChange={(e) => patch({ bookingRequired: e.target.checked })}
          />
          <label className={styles.label} htmlFor={`bookreq-${draft.id}`}>
            Booking required
          </label>
        </div>

        {draft.bookingRequired ? (
          <>
            <label className={styles.label} htmlFor={`bstat-${draft.id}`}>
              Booking status
            </label>
            <select
              id={`bstat-${draft.id}`}
              className={styles.select}
              value={draft.bookingStatus}
              onChange={(e) =>
                patch({ bookingStatus: e.target.value as ItineraryEntry['bookingStatus'] })
              }
            >
              <option value="Not booked">Not booked</option>
              <option value="Booked">Booked</option>
            </select>
          </>
        ) : null}

        <label className={styles.label} htmlFor={`pay-${draft.id}`}>
          Payment
        </label>
        <select
          id={`pay-${draft.id}`}
          className={styles.select}
          value={draft.paymentStatus}
          onChange={(e) => {
            const value = e.target.value as ItineraryEntry['paymentStatus'];
            patch({
              paymentStatus: value,
              amountPaid: value === 'Part paid' ? draft.amountPaid : undefined
            });
          }}
        >
          <option value="Not paid">Not paid</option>
          <option value="Part paid">Part paid</option>
          <option value="Fully paid">Fully paid</option>
        </select>

        {draft.paymentStatus === 'Part paid' ? (
          <>
            <label className={styles.label} htmlFor={`amt-paid-${draft.id}`}>
              Amount paid so far
            </label>
            <input
              id={`amt-paid-${draft.id}`}
              className={styles.input}
              type="number"
              min={0}
              max={draft.amount}
              step={0.01}
              placeholder="0.00"
              value={draft.amountPaid ?? ''}
              onChange={(e) =>
                patch({
                  amountPaid: e.target.value === '' ? undefined : Math.min(draft.amount, Number(e.target.value) || 0)
                })
              }
            />
          </>
        ) : null}

        <label className={styles.label} htmlFor={`amt-${draft.id}`}>
          Amount
        </label>
        <input
          id={`amt-${draft.id}`}
          className={styles.input}
          type="number"
          min={0}
          step={0.01}
          value={Number.isNaN(draft.amount) ? '' : draft.amount}
          onChange={(e) => patch({ amount: e.target.value === '' ? 0 : Number(e.target.value) })}
        />

        <label className={styles.label} htmlFor={`cur-${draft.id}`}>
          Currency
        </label>
        <input
          id={`cur-${draft.id}`}
          className={styles.input}
          type="text"
          maxLength={3}
          value={draft.currency}
          onChange={(e) => patch({ currency: e.target.value.toUpperCase().slice(0, 3) })}
        />
      </div>

      <div className={styles.actions}>
        <button type="button" className={styles.deleteBtn} onClick={onDelete}>
          Delete
        </button>
        <div className={styles.actionsRight}>
          <button type="button" className={styles.btnSecondary} onClick={onCancel}>
            Cancel
          </button>
          <button type="button" className={styles.btnPrimary} disabled={!canSave} onClick={handleSave}>
            Save
          </button>
        </div>
      </div>
    </div>
  );
};
