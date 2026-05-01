import * as React from 'react';
import type { ItinerarySubItem } from '../../models/ItineraryEntry';
import { minutesFromTimeStart } from '../../utils/itineraryTimeUtils';
import { SubItem } from './SubItem';
import styles from './SubItemList.module.css';

export interface SubItemListProps {
  subItems: ItinerarySubItem[];
  entryId: string;
}

interface SubItemGroup {
  key: string;
  label?: string;
  items: ItinerarySubItem[];
}

function groupSubItems(subItems: ItinerarySubItem[]): SubItemGroup[] {
  const groups: SubItemGroup[] = [];
  const indexByKey = new Map<string, number>();
  const sorted = [...subItems].sort((a, b) => {
    const am = minutesFromTimeStart(a.startTime || '');
    const bm = minutesFromTimeStart(b.startTime || '');
    if (am === undefined && bm === undefined) return 0;
    if (am === undefined) return 1;
    if (bm === undefined) return -1;
    return am - bm;
  });

  for (const item of sorted) {
    const label = item.groupLabel?.trim();
    const key = label && label.length > 0 ? `group:${label}` : 'group:ungrouped';
    const idx = indexByKey.get(key);
    if (idx === undefined) {
      indexByKey.set(key, groups.length);
      groups.push({
        key,
        label: label && label.length > 0 ? label : undefined,
        items: [item]
      });
      continue;
    }
    groups[idx].items.push(item);
  }
  return groups;
}

export const SubItemList: React.FC<SubItemListProps> = ({ subItems, entryId }) => {
  const groups = React.useMemo(() => groupSubItems(subItems), [subItems]);

  return (
    <div className={styles.container}>
      {groups.map((group) => (
        <div key={group.key} className={styles.group}>
          {group.label ? (
            <div className={styles.heading}>
              {group.label} ({group.items.length})
            </div>
          ) : null}
          <div className={styles.items}>
            {group.items.map((item) => (
              <SubItem key={item.id} item={item} parentEntryId={entryId} />
            ))}
          </div>
        </div>
      ))}
    </div>
  );
};
