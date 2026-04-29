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
  const [includeHeroOnCover, setIncludeHeroOnCover] = React.useState(true);
  const [showSummary, setShowSummary] = React.useState(true);
  const [includePreTrip, setIncludePreTrip] = React.useState(false);
  const [includeComments, setIncludeComments] = React.useState(true);
  const [includeLikes, setIncludeLikes] = React.useState(true);
  const [layout, setLayout] = React.useState<'photo' | 'text'>('photo');
  const [oneDayPerPage, setOneDayPerPage] = React.useState(false);

  const printableDays = React.useMemo(() => {
    const rows = [...tripDays].sort((a, b) => a.dayNumber - b.dayNumber);
    return includePreTrip ? rows : rows.filter((d) => d.dayType !== 'PreTrip');
  }, [tripDays, includePreTrip]);

  const coverHeroUrl = includeHeroOnCover && trip.heroImageUrl?.trim() ? trip.heroImageUrl.trim() : '';

  return (
    <div className="controls">
      <div className="controlsRow">
        <label>
          <input type="checkbox" checked={showCover} onChange={(e) => setShowCover(e.target.checked)} /> Cover page
        </label>
        <label>
          <input type="checkbox" checked={includeHeroOnCover} onChange={(e) => setIncludeHeroOnCover(e.target.checked)} disabled={!showCover} />{' '}
          Hero image on cover
        </label>
        <label>
          <input type="checkbox" checked={showSummary} onChange={(e) => setShowSummary(e.target.checked)} /> Cover summary
        </label>
        <label>
          <input type="checkbox" checked={includePreTrip} onChange={(e) => setIncludePreTrip(e.target.checked)} /> Include pre-trip
        </label>
        <label>
          <input type="checkbox" checked={includeComments} onChange={(e) => setIncludeComments(e.target.checked)} /> Include comments
        </label>
        <label>
          <input type="checkbox" checked={includeLikes} onChange={(e) => setIncludeLikes(e.target.checked)} /> Include likes
        </label>
        <label>
          <input type="checkbox" checked={oneDayPerPage} onChange={(e) => setOneDayPerPage(e.target.checked)} /> One day per page (print)
        </label>
        <select value={layout} onChange={(e) => setLayout(e.target.value as 'photo' | 'text')}>
          <option value="photo">Photo-heavy</option>
          <option value="text">Text-heavy</option>
        </select>
        <button type="button" className="printPrimaryBtn" onClick={() => window.print()}>
          Print / Save PDF
        </button>
      </div>

      <section className={`th-journal-print printRoot ${oneDayPerPage ? 'dayPageBreaks' : ''}`}>
        {showCover ? (
          <div className={`print-cover-page ${coverHeroUrl ? 'hasHero' : 'noHero'}`}>
            {coverHeroUrl ? <img className="print-cover-hero" src={coverHeroUrl} alt="" /> : null}
            <div className="print-cover-content">
              <h1>{trip.title}</h1>
              <p>{trip.destination}</p>
              <p>
                {trip.dateStart} to {trip.dateEnd}
              </p>
              {showSummary ? (
                <div className="print-cover-summary">
                  <div>
                    <strong>Total days</strong>
                    <span>{printableDays.length}</span>
                  </div>
                  <div>
                    <strong>Journal entries</strong>
                    <span>{entries.length}</span>
                  </div>
                  <div>
                    <strong>Photos</strong>
                    <span>{photos.length}</span>
                  </div>
                  <div>
                    <strong>Budget</strong>
                    <span>Not included in journal export</span>
                  </div>
                </div>
              ) : null}
            </div>
          </div>
        ) : null}

        {printableDays.map((day) => {
          const dayEntries = entries
            .filter((e) => e.dayId === day.id)
            .sort((a, b) => a.entryTimestamp.localeCompare(b.entryTimestamp));
          const dayTitle =
            day.dayType === 'PreTrip' ? 'Pre-trip' : `Day ${day.dayNumber} — ${day.displayTitle}`;
          return (
            <div key={day.id} className="print-day-block">
              <section className="print-day-section">
                <h2 className="print-day-heading">{dayTitle}</h2>
                {day.dayType === 'PreTrip' ? null : <p className="print-entry-meta">{day.calendarDate}</p>}
                {dayEntries.map((entry) => {
                  const entryPhotos = photos.filter((p) => p.journalEntryId === entry.id || (!p.journalEntryId && p.dayId === day.id));
                  const comments = commentsForEntry(entry.id);
                  return (
                    <article key={entry.id} className="print-entry">
                      <h3>
                        {entry.location ? `${entry.location} - ` : ''}
                        {new Date(entry.entryTimestamp).toLocaleString('en-NZ')}
                      </h3>
                      <div className="print-entry-meta">{entry.authorName || ''}</div>
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
                          {comments.map((c) => (
                            <blockquote key={c.id} style={{ margin: '6px 0', fontSize: 12 }}>
                              {c.authorName}: {c.commentText}
                            </blockquote>
                          ))}
                        </div>
                      ) : null}
                    </article>
                  );
                })}
              </section>
            </div>
          );
        })}
      </section>
    </div>
  );
};
