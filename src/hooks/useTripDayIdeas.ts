import * as React from 'react';
import type { WebPartContext } from '@microsoft/sp-webpart-base';
import { useSpContext } from '../context/SpContext';
import { useTripWorkspace } from '../context/TripWorkspaceContext';
import { useTripMembers } from '../hooks/useTripMembers';
import { ReminderService, type TripReminder } from '../services/ReminderService';
import {
  DAY_IDEA_REMINDER_TYPE,
  countUnreadDayIdeas,
  isDayIdeaReminder,
  withDayIdeaMarkedRead
} from '../utils/dayIdeas';
import { getCurrentUserEmail } from '../utils/currentUserEmail';

const CHANGED_EVENT = 'travelhub-day-ideas-changed';

export function notifyDayIdeasChanged(): void {
  window.dispatchEvent(new Event(CHANGED_EVENT));
}

export function useTripDayIdeas(): {
  ideas: TripReminder[];
  unreadCount: number;
  loading: boolean;
  refresh: () => void;
  markRead: (id: string) => Promise<void>;
  markAllRead: () => Promise<void>;
} {
  const spContext = useSpContext();
  const { trip } = useTripWorkspace();
  const { members } = useTripMembers(trip?.id);
  const [ideas, setIdeas] = React.useState<TripReminder[]>([]);
  const [loading, setLoading] = React.useState(false);

  const refresh = React.useCallback(() => {
    if (!trip?.id) {
      setIdeas([]);
      return;
    }
    setLoading(true);
    const svc = new ReminderService(spContext);
    void svc
      .getForTrip(trip.id)
      .then((rows) => {
        setIdeas(
          rows
            .filter(isDayIdeaReminder)
            .sort((a, b) => (b.dueDate || '').localeCompare(a.dueDate || '') || a.id.localeCompare(b.id))
        );
      })
      .finally(() => setLoading(false));
  }, [trip?.id, spContext]);

  React.useEffect(() => {
    refresh();
  }, [refresh]);

  React.useEffect(() => {
    const handler = (): void => refresh();
    window.addEventListener(CHANGED_EVENT, handler);
    return () => window.removeEventListener(CHANGED_EVENT, handler);
  }, [refresh]);

  const unreadCount = React.useMemo(
    () => countUnreadDayIdeas(ideas, spContext, members),
    [ideas, spContext, members]
  );

  const markRead = React.useCallback(
    async (id: string): Promise<void> => {
      const row = ideas.find((x) => x.id === id);
      if (!row) return;
      const patch = withDayIdeaMarkedRead(row, getCurrentUserEmail(spContext));
      if (patch.taskNote === row.taskNote) return;
      const svc = new ReminderService(spContext);
      await svc.update(id, patch);
      refresh();
      notifyDayIdeasChanged();
    },
    [ideas, spContext, refresh]
  );

  const markAllRead = React.useCallback(async (): Promise<void> => {
    const mine = getCurrentUserEmail(spContext);
    const svc = new ReminderService(spContext);
    const unread = ideas.filter((r) => {
      const patch = withDayIdeaMarkedRead(r, mine);
      return patch.taskNote !== r.taskNote;
    });
    await Promise.all(
      unread.map((r) => svc.update(r.id, withDayIdeaMarkedRead(r, mine)))
    );
    if (unread.length) {
      refresh();
      notifyDayIdeasChanged();
    }
  }, [ideas, spContext, refresh]);

  return { ideas, unreadCount, loading, refresh, markRead, markAllRead };
}

export function filterDayIdeasForDay(rows: TripReminder[], dayId: string): TripReminder[] {
  return rows.filter((r) => r.reminderType === DAY_IDEA_REMINDER_TYPE && r.dayId === dayId);
}
