import * as React from 'react';
import type { ItinerarySubItem } from '../../models/ItineraryEntry';
import { formatNZD } from '../../utils/financialUtils';
import styles from './SubItem.module.css';

export interface SubItemProps {
  item: ItinerarySubItem;
}

function decisionDotClass(status: ItinerarySubItem['decisionStatus']): string {
  if (status === 'Planned') {
    return styles.dotPlanned;
  }
  if (status === 'Confirmed') {
    return styles.dotConfirmed;
  }
  return styles.dotIdea;
}

function paymentBadgeClass(status: ItinerarySubItem['paymentStatus']): string {
  if (status === 'Fully paid') {
    return styles.paymentPaid;
  }
  if (status === 'Part paid') {
    return styles.paymentPart;
  }
  return styles.paymentUnpaid;
}

export const SubItem: React.FC<SubItemProps> = ({ item }) => {
  return (
    <div className={styles.row}>
      <div className={styles.left}>
        <span className={`${styles.dot} ${decisionDotClass(item.decisionStatus)}`} aria-hidden />
        <span className={styles.title}>{item.title}</span>
        <span className={`${styles.paymentBadge} ${paymentBadgeClass(item.paymentStatus)}`}>{item.paymentStatus}</span>
      </div>
      <div className={styles.right}>
        {item.amount === 0 ? <span className={styles.free}>Free</span> : <span className={styles.amount}>{formatNZD(item.amount)}</span>}
      </div>
    </div>
  );
};
