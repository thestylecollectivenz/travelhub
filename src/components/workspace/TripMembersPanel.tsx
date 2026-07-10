import * as React from 'react';
import { useSpContext } from '../../context/SpContext';
import { TripMembersService } from '../../services/TripMembersService';
import type { TripMember, TripRoleLevel } from '../../models/TripMember';
import { clearTripRoleCache } from '../../hooks/useCurrentUserRole';
import { useTripRole } from '../../context/TripRoleContext';
import { confirmUserAction } from '../../utils/confirmAction';
import { uploadTripMemberAvatar } from '../../utils/memberAvatarUpload';
import { TravellerAvatar } from '../shared/TravellerAvatar';
import styles from './TripMembersPanel.module.css';

export interface TripMembersPanelProps {
  tripId: string;
  isOpen: boolean;
  onClose: () => void;
}

const ROLES: TripRoleLevel[] = ['Editor', 'Companion', 'Follower'];

export const TripMembersPanel: React.FC<TripMembersPanelProps> = ({ tripId, isOpen, onClose }) => {
  const spContext = useSpContext();
  const { refreshRole } = useTripRole();
  const service = React.useMemo(() => new TripMembersService(spContext), [spContext]);
  const [members, setMembers] = React.useState<TripMember[]>([]);
  const [authorEmail, setAuthorEmail] = React.useState('');
  const [email, setEmail] = React.useState('');
  const [displayName, setDisplayName] = React.useState('');
  const [role, setRole] = React.useState<TripRoleLevel>('Companion');
  const [busy, setBusy] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const avatarInputRef = React.useRef<HTMLInputElement | null>(null);
  const [avatarTargetId, setAvatarTargetId] = React.useState<string | null>(null);

  const refresh = React.useCallback(() => {
    setError(null);
    service
      .getForTrip(tripId)
      .then((rows) => setMembers(rows))
      .catch((err) => {
        console.error(err);
        setMembers([]);
        setError(
          'Could not load trip members. Add a text column AvatarUrl to the TripMembers list if missing, then refresh.'
        );
      });
    service
      .getTripAuthorIdentity(tripId)
      .then((author) => setAuthorEmail(author.email))
      .catch(() => setAuthorEmail(''));
  }, [service, tripId]);

  React.useEffect(() => {
    if (isOpen) {
      setError(null);
      refresh();
    }
  }, [isOpen, refresh]);

  if (!isOpen) return null;

  const pickAvatar = (memberId: string): void => {
    setAvatarTargetId(memberId);
    avatarInputRef.current?.click();
  };

  const onAvatarFile = (file: File | undefined): void => {
    if (!file || !avatarTargetId) return;
    setBusy(true);
    setError(null);
    uploadTripMemberAvatar(spContext, tripId, avatarTargetId, file)
      .then((url) => service.updateAvatarUrl(avatarTargetId, url))
      .then(() => refresh())
      .catch((err) => {
        console.error(err);
        setError(
          'Could not save avatar. Add a text column AvatarUrl to TripMembers, then try again.'
        );
      })
      .then(() => {
        setBusy(false);
        setAvatarTargetId(null);
      }, () => {
        setBusy(false);
        setAvatarTargetId(null);
      });
  };

  const addMember = (): void => {
    const trimmed = email.trim().toLowerCase();
    if (!trimmed) return;
    setBusy(true);
    setError(null);
    service
      .addMember({ tripId, userEmail: trimmed, userDisplayName: displayName.trim() || trimmed, role })
      .then(() => {
        setEmail('');
        setDisplayName('');
        setRole('Companion');
        clearTripRoleCache(tripId);
        refreshRole();
        refresh();
      })
      .catch((err) => {
        console.error(err);
        setError('Could not add member.');
      })
      .then(() => setBusy(false), () => setBusy(false));
  };

  return (
    <div className={styles.backdrop} onClick={(e) => e.target === e.currentTarget && onClose()}>
      <aside className={styles.panel} role="dialog" aria-modal="true" aria-label="Trip access">
        <header className={styles.header}>
          <h2 className={styles.title}>Trip access</h2>
          <button type="button" className={styles.closeBtn} onClick={onClose} aria-label="Close">
            ×
          </button>
        </header>
        <p className={styles.hint}>
          People with access on this trip. Tap a photo to upload an avatar (stored in trip documents). Editor = full control; Companion = traveller (no finances); Follower = read-only onlooker.
        </p>
        <input
          ref={avatarInputRef}
          type="file"
          accept="image/*"
          className={styles.hiddenFile}
          onChange={(e) => {
            const file = e.target.files?.[0];
            onAvatarFile(file);
            e.target.value = '';
          }}
        />
        {error ? <p className={styles.error}>{error}</p> : null}
        <ul className={styles.list}>
          {authorEmail && !members.some((m) => m.userEmail === authorEmail) ? (
            <li className={`${styles.row} ${styles.rowStatic}`}>
              <TravellerAvatar displayName={authorEmail} size={36} />
              <div className={styles.memberMeta}>
                <strong>{authorEmail}</strong>
                <span className={styles.email}>Trip creator · Editor</span>
              </div>
              <span className={styles.roleBadge}>Editor</span>
            </li>
          ) : null}
          {members.length === 0 && !authorEmail ? (
            <li className={styles.muted}>No members in TripMembers yet — trip creator has Editor access.</li>
          ) : (
            members.map((m) => {
              const isTripAuthor = Boolean(authorEmail && m.userEmail === authorEmail);
              return (
              <li key={m.id} className={styles.row}>
                <button
                  type="button"
                  className={styles.avatarBtn}
                  onClick={() => pickAvatar(m.id)}
                  disabled={busy}
                  title="Upload avatar photo"
                  aria-label={`Upload avatar for ${m.userDisplayName || m.userEmail}`}
                >
                  <TravellerAvatar displayName={m.userDisplayName || m.userEmail} avatarUrl={m.avatarUrl} size={36} />
                </button>
                <div className={styles.memberMeta}>
                  <strong>{m.userDisplayName || m.userEmail}</strong>
                  <span className={styles.email}>{m.userEmail}{isTripAuthor ? ' · Trip creator' : ''}</span>
                </div>
                <select
                  className={styles.select}
                  value={isTripAuthor ? 'Editor' : m.role}
                  disabled={busy || isTripAuthor}
                  onChange={(e) => {
                    const next = e.target.value as TripRoleLevel;
                    setBusy(true);
                    service
                      .updateRole(m.id, next)
                      .then(() => {
                        clearTripRoleCache(tripId);
                        refreshRole();
                        refresh();
                      })
                      .catch(console.error)
                      .then(() => setBusy(false), () => setBusy(false));
                  }}
                >
                  {ROLES.map((r) => (
                    <option key={r} value={r}>
                      {r}
                    </option>
                  ))}
                </select>
                <button
                  type="button"
                  className={styles.removeBtn}
                  disabled={busy || isTripAuthor}
                  onClick={() => {
                    void (async () => {
                      if (!(await confirmUserAction(`Remove ${m.userEmail} from this trip?`))) return;
                      setBusy(true);
                      service
                        .removeMember(m.id)
                        .then(() => {
                          clearTripRoleCache(tripId);
                          refreshRole();
                          refresh();
                        })
                        .catch(console.error)
                        .then(() => setBusy(false), () => setBusy(false));
                    })();
                  }}
                >
                  Remove
                </button>
              </li>
            );
            })
          )}
        </ul>
        <div className={styles.addBlock}>
          <h3 className={styles.subtitle}>Invite member</h3>
          <input
            className={styles.input}
            type="email"
            placeholder="Email address"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />
          <input
            className={styles.input}
            placeholder="Display name (optional)"
            value={displayName}
            onChange={(e) => setDisplayName(e.target.value)}
          />
          <select className={styles.select} value={role} onChange={(e) => setRole(e.target.value as TripRoleLevel)}>
            {ROLES.filter((r) => r !== 'Editor').map((r) => (
              <option key={r} value={r}>
                {r}
              </option>
            ))}
            <option value="Editor">Editor</option>
          </select>
          <button type="button" className={styles.addBtn} disabled={busy || !email.trim()} onClick={addMember}>
            Add member
          </button>
        </div>
      </aside>
    </div>
  );
};
