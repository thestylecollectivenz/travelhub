import * as React from 'react';
import type { ItinerarySubItem } from '../../models/ItineraryEntry';
import { useTripWorkspace } from '../../context/TripWorkspaceContext';
import { useConfig } from '../../context/ConfigContext';
import { formatCurrency } from '../../utils/financialUtils';
import { formatTimeHHMM } from '../../utils/itineraryTimeUtils';
import styles from './SubItemDetailLines.module.css';

export interface SubItemDetailLinesProps {
  item: ItinerarySubItem;
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

function timeRangeLabel(s: ItinerarySubItem): string | undefined {
  const t0 = formatTimeHHMM(s.startTime || '');
  const t1 = formatTimeHHMM(s.endTime || '');
  if (t0 && t1) return `${t0}–${t1}`;
  if (t0) return t0;
  if (t1) return t1;
  return undefined;
}

export const SubItemDetailLines: React.FC<SubItemDetailLinesProps> = ({ item, docCount = 0, linkCount = 0 }) => {
  const { config } = useConfig();
  const { convertToHomeCurrency } = useTripWorkspace();
  const home = config.homeCurrency || 'NZD';
  const timeLine = timeRangeLabel(item);
  const cur = (item.currency || 'NZD').toUpperCase();
  const homeAmount = convertToHomeCurrency(item.amount, cur);
  const showCost = item.paymentStatus !== 'Free';

  return (
    <div className={styles.root}>
      {item.groupLabel?.trim() ? <div className={styles.groupLabel}>{item.groupLabel.trim()}</div> : null}
      <div className={styles.title}>{item.title || 'Untitled option'}</div>
      {timeLine ? <div className={styles.timeLine}>{timeLine}</div> : null}
      <div className={styles.badges}>
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
      {item.notes?.trim() ? <div className={styles.notes}>{item.notes.trim()}</div> : null}
    </div>
  );
};
