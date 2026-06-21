import * as React from 'react';
import type { ItineraryEntry, ItinerarySubItem } from '../../models/ItineraryEntry';
import { formatActivityScheduleLabel } from '../../utils/activityScheduleLabel';
import { formatEntryScheduleHero } from '../../utils/itineraryDayEntries';
import { getCategorySlug } from '../../utils/categoryUtils';
import { useTripWorkspace } from '../../context/TripWorkspaceContext';
import { useConfig } from '../../context/ConfigContext';
import { formatCurrency } from '../../utils/financialUtils';
import { formatTimeHHMM } from '../../utils/itineraryTimeUtils';
import { formatLocationText } from '../../utils/placeDisplayLabel';
import { RichTextContent } from '../shared/RichTextContent';
import styles from './SubItemDetailLines.module.css';

export interface SubItemDetailLinesProps {
  item: ItinerarySubItem;
  calendarDate?: string;
  docCount?: number;
  linkCount?: number;
}

function decisionBadgeClass(status: ItinerarySubItem['decisionStatus']): string {
  if (status === 'Planned') return styles.badgePlanned;
  if (status === 'Confirmed') return styles.badgeConfirmed;
  return styles.badgeIdea;
}

function paymentBadgeClass(status: ItinerarySubItem['paymentStatus']): string {
  if (status === 'Free') return styles.payFree;
  if (status === 'Fully paid') return styles.payPaid;
  if (status === 'Part paid') return styles.payPart;
  return styles.payUnpaid;
}

function timeRangeLabel(s: ItinerarySubItem, calendarDate?: string): string | undefined {
  const activitySchedule =
    (s.category || '').trim() === 'Activities' || s.duration?.trim()
      ? formatActivityScheduleLabel({
          calendarDate,
          timeStart: s.startTime,
          duration: s.duration,
          arrivalTime: s.endTime
        })
      : undefined;
  if (activitySchedule) return activitySchedule;
  const t0 = formatTimeHHMM(s.startTime || '');
  const t1 = formatTimeHHMM(s.endTime || '');
  if (t0 && t1) return `${t0}–${t1}`;
  if (t0) return t0;
  if (t1) return t1;
  return undefined;
}

export const SubItemDetailLines: React.FC<SubItemDetailLinesProps> = ({
  item,
  calendarDate,
  docCount = 0,
  linkCount = 0
}) => {
  const { config } = useConfig();
  const { convertToHomeCurrency } = useTripWorkspace();
  const home = config.homeCurrency || 'NZD';
  const timeLine = timeRangeLabel(item, calendarDate);
  const scheduleHero = formatEntryScheduleHero(
    { id: item.id, category: item.category || 'Activities', dayId: '', title: item.title } as ItineraryEntry,
    calendarDate || '',
    undefined,
    { subItem: item }
  );
  const locationLine = formatLocationText((item.location || '').trim());
  const cur = (item.currency || 'NZD').toUpperCase();
  const homeAmount = convertToHomeCurrency(item.amount, cur);
  const showCost = item.paymentStatus !== 'Free';

  return (
    <div className={styles.root}>
      {item.groupLabel?.trim() ? <div className={styles.groupLabel}>{item.groupLabel.trim()}</div> : null}
      <div className={styles.title}>{item.title || 'Untitled option'}</div>
      {scheduleHero ? (
        <div className={`${styles.scheduleHero} th-cat-${getCategorySlug(item.category || 'Activities')} th-cat-border`}>
          {scheduleHero}
        </div>
      ) : timeLine ? (
        <div className={styles.timeLine}>{timeLine}</div>
      ) : null}
      {locationLine ? <div className={styles.locationLine}>{locationLine}</div> : null}
      <div className={styles.badges}>
        {item.category?.trim() ? (
          <span className={`${styles.badge} th-cat-badge th-cat-${getCategorySlug(item.category)}`}>{item.category}</span>
        ) : null}
        <span className={`${styles.badge} ${decisionBadgeClass(item.decisionStatus)}`}>{item.decisionStatus}</span>
        <span className={`${styles.payBadge} ${paymentBadgeClass(item.paymentStatus)}`}>{item.paymentStatus}</span>
        {item.bookingRequired ? <span className={styles.bookingFlag}>Booking required</span> : null}
        {docCount > 0 ? (
          <span className={styles.countBadge} title="Files attached to this option">
            {docCount} file{docCount === 1 ? '' : 's'}
          </span>
        ) : null}
        {linkCount > 0 ? (
          <span className={styles.countBadge} title="Links attached to this option">
            {linkCount} link{linkCount === 1 ? '' : 's'}
          </span>
        ) : null}
      </div>
      {showCost ? (
        <div className={styles.costBlock}>
          <span className={styles.costMain}>{formatCurrency(homeAmount, home)}</span>
          {cur !== home.toUpperCase() ? (
            <span className={styles.costSub}>
              {' '}
              ({formatCurrency(item.amount, cur)})
            </span>
          ) : null}
          {item.paymentStatus === 'Part paid' && item.amountPaid !== undefined ? (
            <div className={styles.partPaid}>Paid so far: {formatCurrency(convertToHomeCurrency(item.amountPaid, cur), home)}</div>
          ) : null}
        </div>
      ) : (
        <div className={styles.freeLine}>No charge</div>
      )}
      {item.cancellationPolicy?.trim() ? (
        <div className={styles.cancelLine}>Cancellation: {item.cancellationPolicy.trim()}</div>
      ) : null}
      {item.notes?.trim() ? (
        <div className={styles.notes}>
          <RichTextContent html={item.notes.trim()} />
        </div>
      ) : null}
    </div>
  );
};
