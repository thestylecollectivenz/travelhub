import * as React from 'react';
import type { Trip } from '../../models/Trip';
import type { TripDay } from '../../models/TripDay';
import type { TripDateRangeChangePlan } from '../../utils/tripDateRangeSync';
import {
  buildTargetDayOptions,
  suggestReassignmentTargetDayId,
  ymdSlice
} from '../../utils/tripDateRangeSync';

export interface TripDateRangeReassignDialogProps {
  trip: Trip;
  plan: TripDateRangeChangePlan;
  tripDays: TripDay[];
  mappings: Record<string, string>;
  onMappingsChange: (next: Record<string, string>) => void;
  busy: boolean;
  onCancel: () => void;
  onConfirm: () => void;
}

function formatYmd(ymd: string): string {
  const d = new Date(`${ymdSlice(ymd)}T12:00:00.000Z`);
  if (Number.isNaN(d.getTime())) return ymd;
  return d.toLocaleDateString('en-NZ', { day: 'numeric', month: 'short', year: 'numeric' });
}

function contentSummary(row: { itineraryCount: number; journalEntryCount: number; journalPhotoCount: number }): string {
  const parts: string[] = [];
  if (row.itineraryCount) parts.push(`${row.itineraryCount} itinerary`);
  if (row.journalEntryCount) parts.push(`${row.journalEntryCount} journal`);
  if (row.journalPhotoCount) parts.push(`${row.journalPhotoCount} photo${row.journalPhotoCount === 1 ? '' : 's'}`);
  return parts.join(', ') || 'content';
}

const backdropStyle: React.CSSProperties = {
  position: 'fixed',
  inset: 0,
  zIndex: 1300,
  background: 'rgba(0, 0, 0, 0.45)',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  padding: 'var(--space-4)'
};

const panelStyle: React.CSSProperties = {
  width: 'min(100%, 36rem)',
  maxHeight: 'min(90vh, 40rem)',
  overflow: 'auto',
  background: 'var(--color-surface-raised)',
  borderRadius: 'var(--radius-lg)',
  boxShadow: 'var(--shadow-elevated)',
  padding: 'var(--space-5)',
  display: 'grid',
  gap: 'var(--space-4)'
};

export const TripDateRangeReassignDialog: React.FC<TripDateRangeReassignDialogProps> = ({
  trip,
  plan,
  tripDays,
  mappings,
  onMappingsChange,
  busy,
  onCancel,
  onConfirm
}) => {
  const targetOptions = React.useMemo(
    () => buildTargetDayOptions(tripDays, plan.datesToCreate, plan.newStart, plan.newEnd),
    [tripDays, plan.datesToCreate, plan.newStart, plan.newEnd]
  );

  const projectedTargets = React.useMemo(() => {
    const extra: TripDay[] = plan.datesToCreate.map((ymd, i) => ({
      id: `__new__${ymd}`,
      tripId: trip.id,
      dayNumber: 9000 + i,
      calendarDate: ymd,
      displayTitle: 'Day (new)',
      dayType: 'PlacePort' as const
    }));
    return [...tripDays, ...extra];
  }, [plan.datesToCreate, trip.id, tripDays]);

  React.useEffect(() => {
    const next: Record<string, string> = { ...mappings };
    let changed = false;
    for (const row of plan.orphanedDays) {
      if (next[row.day.id]) continue;
      const suggested = suggestReassignmentTargetDayId(
        row.day.calendarDate,
        projectedTargets,
        plan.newStart,
        plan.newEnd
      );
      if (suggested) {
        next[row.day.id] = suggested;
        changed = true;
      } else if (targetOptions[0]) {
        next[row.day.id] = targetOptions[0].id;
        changed = true;
      }
    }
    if (changed) onMappingsChange(next);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- seed defaults when dialog opens
  }, [plan.orphanedDays, plan.newStart, plan.newEnd, projectedTargets, targetOptions]);

  const allMapped = plan.orphanedDays.every((row) => {
    const target = mappings[row.day.id];
    return Boolean(target && target !== row.day.id);
  });

  return (
    <div
      style={backdropStyle}
      role="dialog"
      aria-modal="true"
      aria-label="Reassign trip content to new dates"
      onClick={(e) => {
        if (e.target === e.currentTarget && !busy) onCancel();
      }}
    >
      <div style={panelStyle} onClick={(e) => e.stopPropagation()}>
        <div>
          <h2 style={{ margin: 0, fontSize: 'var(--font-size-lg)', color: 'var(--color-blue-800)' }}>
            Reassign content to new trip dates
          </h2>
          <p style={{ margin: 'var(--space-2) 0 0', fontSize: 'var(--font-size-sm)', color: 'var(--color-sand-700)' }}>
            {trip.title} will run {formatYmd(plan.newStart)} – {formatYmd(plan.newEnd)}. Some days with saved itinerary or
            journal content fall outside that range
            {!plan.hasOverlapWithContentDays ? ' and do not overlap the new dates' : ''}. Choose where each day&apos;s
            content should move. Cards on days that still match a date are left unchanged.
          </p>
        </div>
        <div style={{ display: 'grid', gap: 'var(--space-3)' }}>
          {plan.orphanedDays.map((row) => (
            <label key={row.day.id} style={{ display: 'grid', gap: 'var(--space-1)' }}>
              <span style={{ fontSize: 'var(--font-size-sm)', color: 'var(--color-blue-700)' }}>
                {row.day.displayTitle || `Day ${row.day.dayNumber}`} ({formatYmd(row.day.calendarDate)}) —{' '}
                {contentSummary(row.content)}
              </span>
              <select
                value={mappings[row.day.id] ?? ''}
                disabled={busy}
                onChange={(e) =>
                  onMappingsChange({
                    ...mappings,
                    [row.day.id]: e.target.value
                  })
                }
                style={{
                  padding: 'var(--space-2) var(--space-3)',
                  border: 'var(--border-default)',
                  borderRadius: 'var(--radius-md)'
                }}
              >
                <option value="">Select target day…</option>
                {targetOptions.map((opt) => (
                  <option key={opt.id} value={opt.id}>
                    {opt.label}
                  </option>
                ))}
              </select>
            </label>
          ))}
        </div>
        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 'var(--space-3)', flexWrap: 'wrap' }}>
          <button
            type="button"
            disabled={busy}
            onClick={onCancel}
            style={{
              padding: 'var(--space-2) var(--space-4)',
              background: 'transparent',
              border: 'var(--border-default)',
              borderRadius: 'var(--radius-md)',
              cursor: busy ? 'not-allowed' : 'pointer'
            }}
          >
            Cancel
          </button>
          <button
            type="button"
            disabled={busy || !allMapped}
            onClick={onConfirm}
            style={{
              padding: 'var(--space-2) var(--space-4)',
              border: 'none',
              borderRadius: 'var(--radius-md)',
              background: busy || !allMapped ? 'var(--color-sand-300)' : 'var(--color-primary)',
              color: busy || !allMapped ? 'var(--color-sand-600)' : 'var(--color-surface-raised)',
              cursor: busy || !allMapped ? 'not-allowed' : 'pointer'
            }}
          >
            {busy ? 'Saving…' : 'Save trip dates'}
          </button>
        </div>
      </div>
    </div>
  );
};
