import * as React from 'react';
import type { Trip } from '../../models/Trip';
import type { TripDay } from '../../models/TripDay';
import type { JournalEntry, JournalPhoto, JournalComment } from '../../models';
import './JournalPdfExport.css';

export interface JournalPdfExportProps {
  trip: Trip;
  tripDays: TripDay[];
  entries: JournalEntry[];
  photos: JournalPhoto[];
  commentsForEntry: (entryId: string) => JournalComment[];
}

export const JournalPdfExport: React.FC<JournalPdfExportProps> = ({ trip, tripDays, entries, photos, commentsForEntry }) => {
  const [showCover, setShowCover] = React.useState(true);
  const [includePreTrip, setIncludePreTrip] = React.useState(false);
  const [includeComments, setIncludeComments] = React.useState(true);
  const [includeLikes, setIncludeLikes] = React.useState(true);
  const [layout, setLayout] = React.useState<'photo' | 'text'>('photo');

  const printableDays = React.useMemo(() => {
    const rows = [...tripDays].sort((a, b) => a.dayNumber - b.dayNumber);
    return includePreTrip ? rows : rows.filter((d) => d.dayType !== 'PreTrip');
  }, [tripDays, includePreTrip]);

  return (
    <div className="controls">
      <div className="controlsRow">
        <label><input type="checkbox" checked={showCover} onChange={(e) => setShowCover(e.target.checked)} /> Cover page</label>
        <label><input type="checkbox" checked={includePreTrip} onChange={(e) => setIncludePreTrip(e.target.checked)} /> Include pre-trip</label>
        <label><input type="checkbox" checked={includeComments} onChange={(e) => setIncludeComments(e.target.checked)} /> Include comments</label>
        <label><input type="checkbox" checked={includeLikes} onChange={(e) => setIncludeLikes(e.target.checked)} /> Include likes</label>
        <select value={layout} onChange={(e) => setLayout(e.target.value as 'photo' | 'text')}>
          <option value="photo">Photo-heavy</option>
          <option value="text">Text-heavy</option>
        </select>
        <button type="button" onClick={() => window.print()}>Print / Save PDF</button>
      </div>

      <section className="th-journal-print printRoot">
        {showCover ? (
          <div>
            <h1>{trip.title}</h1>
            <p>{trip.destination}</p>
            <p>{trip.dateStart} to {trip.dateEnd}</p>
            <div className="page-break" />
          </div>
        ) : null}

        {printableDays.map((day) => {
          const dayEntries = entries.filter((e) => e.dayId === day.id).sort((a, b) => a.entryTimestamp.localeCompare(b.entryTimestamp));
          return (
            <div key={day.id}>
              <h2>Day {day.dayNumber} - {day.displayTitle}</h2>
              <p>{day.calendarDate}</p>
              {dayEntries.map((entry) => {
                const entryPhotos = photos.filter((p) => p.journalEntryId === entry.id || (!p.journalEntryId && p.dayId === day.id));
                const comments = commentsForEntry(entry.id);
                return (
                  <article key={entry.id} style={{ marginBottom: 16 }}>
                    <h3>{entry.location ? `${entry.location} - ` : ''}{new Date(entry.entryTimestamp).toLocaleString('en-NZ')}</h3>
                    <div dangerouslySetInnerHTML={{ __html: entry.entryText || '' }} />
                    {includeLikes ? <div>Likes: {entry.likeCount}</div> : null}
                    {entryPhotos.length ? (
                      <div className={`photoGrid ${layout === 'photo' ? 'photoHeavy' : 'textHeavy'}`}>
                        {entryPhotos.map((p) => (
                          <figure key={p.id} style={{ margin: 0 }}>
                            <img src={p.fileUrl} alt={p.caption || 'Journal photo'} />
                            {p.caption ? <figcaption style={{ fontSize: 11 }}>{p.caption}</figcaption> : null}
                          </figure>
                        ))}
                      </div>
                    ) : null}
                    {includeComments && comments.length ? (
                      <div style={{ marginTop: 8 }}>
                        {comments.map((c) => <blockquote key={c.id} style={{ margin: '6px 0', fontSize: 12 }}>{c.authorName}: {c.commentText}</blockquote>)}
                      </div>
                    ) : null}
                  </article>
                );
              })}
              <div className="page-break" />
            </div>
          );
        })}
      </section>
    </div>
  );
};
