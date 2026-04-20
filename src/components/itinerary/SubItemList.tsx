import * as React from 'react';
import type { ItinerarySubItem } from '../../models/ItineraryEntry';
import { SubItem } from './SubItem';
import styles from './SubItemList.module.css';

export interface SubItemListProps {
  subItems: ItinerarySubItem[];
}

interface SubItemGroup {
  key: string;
  label?: string;
  items: ItinerarySubItem[];
}

function groupSubItems(subItems: ItinerarySubItem[]): SubItemGroup[] {
  const groups: SubItemGroup[] = [];
  const indexByKey = new Map<string, number>();
  for (const item of subItems) {
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

export const SubItemList: React.FC<SubItemListProps> = ({ subItems }) => {
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
              <SubItem key={item.id} item={item} />
            ))}
          </div>
        </div>
      ))}
    </div>
  );
};
