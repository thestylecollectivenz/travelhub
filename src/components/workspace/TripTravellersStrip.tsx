import * as React from 'react';
import { useSpContext } from '../../context/SpContext';
import { TripMembersService } from '../../services/TripMembersService';
import type { TripMember } from '../../models/TripMember';
import { TravellerAvatar } from '../shared/TravellerAvatar';
import styles from './TripTravellersStrip.module.css';

export interface TripTravellersStripProps {
  tripId: string;
  onOpenMembers: () => void;
}

const MAX_VISIBLE = 5;

export const TripTravellersStrip: React.FC<TripTravellersStripProps> = ({ tripId, onOpenMembers }) => {
  const spContext = useSpContext();
  const service = React.useMemo(() => new TripMembersService(spContext), [spContext]);
  const [members, setMembers] = React.useState<TripMember[]>([]);
  const [authorLabel, setAuthorLabel] = React.useState('');

  React.useEffect(() => {
    let cancelled = false;
    Promise.all([service.getForTrip(tripId), service.getTripAuthorIdentity(tripId)])
      .then(([rows, author]) => {
        if (cancelled) return;
        setMembers(rows);
        setAuthorLabel(author.email);
      })
      .catch(() => {
        if (!cancelled) setMembers([]);
      });
    return () => {
      cancelled = true;
    };
  }, [service, tripId]);

  const visible = members.slice(0, MAX_VISIBLE);
  const extra = Math.max(0, members.length - MAX_VISIBLE);

  return (
    <button type="button" className={styles.strip} onClick={onOpenMembers} title="Trip access and avatars">
      <span className={styles.label}>Travellers</span>
      <span className={styles.avatars} aria-hidden>
        {visible.length ? (
          visible.map((m) => (
            <TravellerAvatar
              key={m.id}
              displayName={m.userDisplayName || m.userEmail}
              avatarUrl={m.avatarUrl}
              size={28}
              className={styles.avatar}
            />
          ))
        ) : authorLabel ? (
          <TravellerAvatar displayName={authorLabel} size={28} className={styles.avatar} />
        ) : (
          <span className={styles.emptyDot}>+</span>
        )}
        {extra > 0 ? <span className={styles.more}>+{extra}</span> : null}
      </span>
    </button>
  );
};
