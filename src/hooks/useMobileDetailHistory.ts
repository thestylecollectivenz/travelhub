import * as React from 'react';

export interface MobileDetailHistoryTarget {
  entryId: string;
  subItemId?: string;
}

/**
 * Syncs mobile card detail open/close with browser history so Back returns to the
 * detail view (or closes detail) instead of leaving the trip.
 */
export function useMobileDetailHistory(
  detailTarget: MobileDetailHistoryTarget | null,
  setDetailTarget: React.Dispatch<React.SetStateAction<MobileDetailHistoryTarget | null>>
): { closeDetail: () => void } {
  const skipPopCloseRef = React.useRef(false);
  const pushedRef = React.useRef(false);

  const closeDetail = React.useCallback(() => {
    if (!detailTarget) {
      setDetailTarget(null);
      return;
    }
    setDetailTarget(null);
    if (pushedRef.current) {
      pushedRef.current = false;
      skipPopCloseRef.current = true;
      window.history.back();
    }
  }, [detailTarget, setDetailTarget]);

  React.useEffect(() => {
    if (!detailTarget) return;
    const state = {
      thMobileCardDetail: true,
      entryId: detailTarget.entryId,
      subItemId: detailTarget.subItemId ?? null
    };
    window.history.pushState(state, '');
    pushedRef.current = true;
  }, [detailTarget?.entryId, detailTarget?.subItemId]);

  React.useEffect(() => {
    const onPopState = (): void => {
      if (skipPopCloseRef.current) {
        skipPopCloseRef.current = false;
        return;
      }
      pushedRef.current = false;
      setDetailTarget(null);
    };
    window.addEventListener('popstate', onPopState);
    return () => window.removeEventListener('popstate', onPopState);
  }, [setDetailTarget]);

  return { closeDetail };
}

/** Open external URLs in a new tab without navigating the SPA away (mobile PDF viewer). */
export function openMobileExternalUrl(url: string, event?: React.MouseEvent): void {
  event?.preventDefault();
  event?.stopPropagation();
  window.open(url, '_blank', 'noopener,noreferrer');
}
