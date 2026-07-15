import * as React from 'react';
import { useConfig } from '../../context/ConfigContext';
import { useSpContext } from '../../context/SpContext';
import { useTripMembers } from '../../hooks/useTripMembers';
import { getCurrentUserDisplayName } from '../../utils/currentUserEmail';
import { TravellerAvatar } from '../shared/TravellerAvatar';
import { useMobileHeaderChrome } from './MobileHeaderChromeContext';
import styles from './MobileHeaderAccessActions.module.css';

function IconGear(): React.ReactElement {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden>
      <path
        d="M12 15.5a3.5 3.5 0 1 0 0-7 3.5 3.5 0 0 0 0 7Z"
        stroke="currentColor"
        strokeWidth="1.8"
      />
      <path
        d="M19.4 13a7.97 7.97 0 0 0 .1-2l2-1.2-2-3.5-2.3 1a8.1 8.1 0 0 0-1.7-1L15 3h-6l-.5 2.3a8.1 8.1 0 0 0-1.7 1l-2.3-1-2 3.5L4.5 11a7.97 7.97 0 0 0 .1 2L4.4 14l2 3.5 2.3-1a8.1 8.1 0 0 0 1.7 1L9 21h6l.5-2.3a8.1 8.1 0 0 0 1.7-1l2.3 1 2-3.5-1.9-1Z"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function openSettings(): void {
  if (typeof window === 'undefined') return;
  window.dispatchEvent(new Event('travelhub-open-settings'));
}

export interface MobileHeaderAccessActionsProps {
  /** Override trip id from MobileHeaderChromeProvider. */
  accessTripId?: string;
  /** Override open-access handler from MobileHeaderChromeProvider. */
  onOpenAccess?: () => void;
  /** Override open-settings handler from MobileHeaderChromeProvider. */
  onOpenSettings?: () => void;
}

/** Home-style trip access avatar + profile gear — top-right on every brand header. */
export const MobileHeaderAccessActions: React.FC<MobileHeaderAccessActionsProps> = ({
  accessTripId: accessTripIdProp,
  onOpenAccess: onOpenAccessProp,
  onOpenSettings: onOpenSettingsProp
}) => {
  const chrome = useMobileHeaderChrome();
  const spContext = useSpContext();
  const { greetingName } = useConfig();
  const tripId = accessTripIdProp ?? chrome.accessTripId;
  const onOpenAccess = onOpenAccessProp ?? chrome.onOpenAccess;
  const onOpenSettings = onOpenSettingsProp ?? chrome.onOpenSettings ?? openSettings;
  const { myMember } = useTripMembers(tripId);
  const displayName = getCurrentUserDisplayName(spContext);

  return (
    <div className={styles.actions}>
      <button
        type="button"
        className={styles.avatarBtn}
        aria-label="Trip access"
        disabled={!tripId || !onOpenAccess}
        onClick={() => onOpenAccess?.()}
      >
        <TravellerAvatar
          displayName={myMember?.userDisplayName || greetingName || displayName}
          avatarUrl={myMember?.avatarUrl}
          size={36}
        />
      </button>
      <button type="button" className={styles.iconBtn} aria-label="Traveller profile" onClick={onOpenSettings}>
        <IconGear />
      </button>
    </div>
  );
};
