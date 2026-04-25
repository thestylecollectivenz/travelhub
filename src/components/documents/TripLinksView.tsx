import * as React from 'react';
import type { EntryLink } from '../../models';
import { useAttachments } from '../../context/AttachmentsContext';
import { useTripWorkspace } from '../../context/TripWorkspaceContext';
import styles from './TripLinksView.module.css';

export const TripLinksView: React.FC = () => {
  const { links, addLink, updateLink, deleteLink, highlightedLinkId } = useAttachments();
  const { trip, tripDays, localEntries } = useTripWorkspace();
  const [search, setSearch] = React.useState('');
  const [typeFilter, setTypeFilter] = React.useState<'all' | EntryLink['linkType']>('all');
  const [dayFilter, setDayFilter] = React.useState<string>('all');
  const [adding, setAdding] = React.useState(false);
  const [editingId, setEditingId] = React.useState<string | null>(null);
  const [saving, setSaving] = React.useState(false);
  const [draft, setDraft] = React.useState<{
    dayId: string;
    entryId: string;
    linkTitle: string;
    url: string;
    linkType: EntryLink['linkType'];
    notes: string;
  }>({
    dayId: '',
    entryId: '',
    linkTitle: '',
    url: '',
    linkType: 'Url',
    notes: ''
  });

  const days = React.useMemo(() => {
    if (!trip) return [];
    return tripDays.filter((d) => d.tripId === trip.id).sort((a, b) => a.dayNumber - b.dayNumber);
  }, [trip, tripDays]);

  const dayLabel = React.useCallback(
    (dayId: string): string => days.find((d) => d.id === dayId)?.displayTitle ?? 'No day',
    [days]
  );
  const entryLabel = React.useCallback(
    (entryId: string): string => localEntries.find((e) => e.id === entryId)?.title ?? 'No entry',
    [localEntries]
  );

  const visible = React.useMemo(() => {
    const q = search.trim().toLowerCase();
    return links.filter((l) => {
      if (typeFilter !== 'all' && l.linkType !== typeFilter) return false;
      if (dayFilter !== 'all' && l.dayId !== dayFilter) return false;
      if (!q) return true;
      return l.linkTitle.toLowerCase().includes(q) || l.url.toLowerCase().includes(q) || (l.notes || '').toLowerCase().includes(q);
    });
  }, [links, typeFilter, dayFilter, search]);

  const startEdit = React.useCallback((link: EntryLink) => {
    setEditingId(link.id);
    setDraft({
      dayId: link.dayId,
      entryId: link.entryId,
      linkTitle: link.linkTitle,
      url: link.url,
      linkType: link.linkType,
      notes: link.notes
    });
  }, []);

  return (
    <section className={styles.root} aria-label="Trip links">
      <header className={styles.header}>
        <h2 className={styles.title}>Links</h2>
        <button type="button" className={`${styles.button} ${styles.buttonPrimary}`} onClick={() => setAdding((v) => !v)}>
          {adding ? 'Close form' : 'Add link'}
        </button>
      </header>

      <div className={styles.filters}>
        <input className={styles.input} placeholder="Search title, URL, notes" value={search} onChange={(e) => setSearch(e.target.value)} />
        <select className={styles.select} value={typeFilter} onChange={(e) => setTypeFilter(e.target.value as 'all' | EntryLink['linkType'])}>
          <option value="all">All link types</option>
          <option value="Url">Url</option>
          <option value="Supplier">Supplier</option>
          <option value="Booking">Booking</option>
          <option value="Email">Email</option>
          <option value="Other">Other</option>
        </select>
        <select className={styles.select} value={dayFilter} onChange={(e) => setDayFilter(e.target.value)}>
          <option value="all">All days</option>
          {days.map((d) => (
            <option key={d.id} value={d.id}>
              Day {d.dayNumber} — {d.displayTitle}
            </option>
          ))}
        </select>
      </div>

      {adding ? (
        <div className={styles.row}>
          <div className={styles.line2}>
            <input className={styles.input} placeholder="Title" value={draft.linkTitle} onChange={(e) => setDraft((prev) => ({ ...prev, linkTitle: e.target.value }))} />
            <input className={styles.input} placeholder="URL" value={draft.url} onChange={(e) => setDraft((prev) => ({ ...prev, url: e.target.value }))} />
            <select className={styles.select} value={draft.linkType} onChange={(e) => setDraft((prev) => ({ ...prev, linkType: e.target.value as EntryLink['linkType'] }))}>
              <option value="Url">Url</option>
              <option value="Supplier">Supplier</option>
              <option value="Booking">Booking</option>
              <option value="Email">Email</option>
              <option value="Other">Other</option>
            </select>
            <input className={styles.input} placeholder="Notes (optional)" value={draft.notes} onChange={(e) => setDraft((prev) => ({ ...prev, notes: e.target.value }))} />
            <select className={styles.select} value={draft.dayId} onChange={(e) => setDraft((prev) => ({ ...prev, dayId: e.target.value }))}>
              <option value="">No day linked</option>
              {days.map((d) => (
                <option key={d.id} value={d.id}>
                  Day {d.dayNumber} — {d.displayTitle}
                </option>
              ))}
            </select>
            <select className={styles.select} value={draft.entryId} onChange={(e) => setDraft((prev) => ({ ...prev, entryId: e.target.value }))}>
              <option value="">No entry linked</option>
              {localEntries
                .filter((e) => !draft.dayId || e.dayId === draft.dayId)
                .map((e) => (
                  <option key={e.id} value={e.id}>
                    {e.title || 'Untitled'}
                  </option>
                ))}
            </select>
          </div>
          <div className={styles.actions}>
            <button
              type="button"
              className={styles.button}
              disabled={saving || draft.linkTitle.trim() === '' || draft.url.trim() === ''}
              onClick={() => {
                if (!trip) return;
                setSaving(true);
                addLink({
                  dayId: draft.dayId,
                  entryId: draft.entryId,
                  linkType: draft.linkType,
                  url: draft.url.trim(),
                  linkTitle: draft.linkTitle.trim(),
                  notes: draft.notes.trim()
                })
                  .then(() => {
                    setDraft({ dayId: '', entryId: '', linkTitle: '', url: '', linkType: 'Url', notes: '' });
                    setAdding(false);
                    setSaving(false);
                  })
                  .catch((err) => {
                    setSaving(false);
                    // eslint-disable-next-line no-console
                    console.error(err);
                  });
              }}
            >
              Save link
            </button>
          </div>
        </div>
      ) : null}

      {visible.length === 0 ? (
        <div className={styles.empty}>No links yet</div>
      ) : (
        <div className={styles.list}>
          {visible.map((link) => {
            const rowEditing = editingId === link.id;
            return (
              <div key={link.id} className={styles.row} style={highlightedLinkId === link.id ? { outline: '2px solid var(--color-primary)' } : undefined}>
                {rowEditing ? (
                  <>
                    <div className={styles.line2}>
                      <input className={styles.input} value={draft.linkTitle} onChange={(e) => setDraft((prev) => ({ ...prev, linkTitle: e.target.value }))} />
                      <input className={styles.input} value={draft.url} onChange={(e) => setDraft((prev) => ({ ...prev, url: e.target.value }))} />
                      <select className={styles.select} value={draft.linkType} onChange={(e) => setDraft((prev) => ({ ...prev, linkType: e.target.value as EntryLink['linkType'] }))}>
                        <option value="Url">Url</option>
                        <option value="Supplier">Supplier</option>
                        <option value="Booking">Booking</option>
                        <option value="Email">Email</option>
                        <option value="Other">Other</option>
                      </select>
                      <input className={styles.input} value={draft.notes} onChange={(e) => setDraft((prev) => ({ ...prev, notes: e.target.value }))} placeholder="Notes (optional)" />
                    </div>
                    <div className={styles.actions}>
                      <button
                        type="button"
                        className={styles.button}
                        onClick={() => {
                          setSaving(true);
                          updateLink(link.id, {
                            linkTitle: draft.linkTitle.trim(),
                            title: draft.linkTitle.trim(),
                            url: draft.url.trim(),
                            linkType: draft.linkType,
                            notes: draft.notes.trim()
                          })
                            .then(() => {
                              setEditingId(null);
                              setSaving(false);
                            })
                            .catch((err) => {
                              setSaving(false);
                              // eslint-disable-next-line no-console
                              console.error(err);
                            });
                        }}
                        disabled={saving}
                      >
                        Save
                      </button>
                      <button type="button" className={styles.button} onClick={() => setEditingId(null)}>
                        Cancel
                      </button>
                    </div>
                  </>
                ) : (
                  <>
                    <div className={styles.line1}>
                      <span className={styles.badge}>{link.linkType}</span>
                      <a className={styles.linkTitle} href={link.url} target="_blank" rel="noreferrer">
                        {link.linkTitle}
                      </a>
                      <span className={styles.url}>{link.url}</span>
                    </div>
                    <div className={styles.line2}>
                      <span className={styles.badge}>{link.dayId ? dayLabel(link.dayId) : 'No day'}</span>
                      <span className={styles.badge}>{link.entryId ? entryLabel(link.entryId) : 'No entry'}</span>
                      {link.notes ? <span className={styles.url}>{link.notes}</span> : null}
                    </div>
                    <div className={styles.actions}>
                      <button type="button" className={styles.button} onClick={() => startEdit(link)}>
                        Edit
                      </button>
                      <button type="button" className={styles.button} onClick={() => deleteLink(link.id).catch(console.error)}>
                        Delete
                      </button>
                    </div>
                  </>
                )}
              </div>
            );
          })}
        </div>
      )}
    </section>
  );
};

