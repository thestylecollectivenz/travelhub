import * as React from 'react';
import type { Trip } from '../../models/Trip';
import type { TripDay } from '../../models/TripDay';
import type { JournalEntry, JournalPhoto, JournalComment } from '../../models';
import { openJournalPrintPreview } from '../../utils/journalPrintPreview';
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

  const openPreview = React.useCallback((): void => {
    openJournalPrintPreview({
      trip,
      tripDays,
      entries,
      photos,
      commentsForEntry,
      showCover,
      includeHeroOnCover,
      showSummary,
      includePreTrip,
      includeComments,
      includeLikes,
      layout,
      oneDayPerPage
    });
  }, [
    trip,
    tripDays,
    entries,
    photos,
    commentsForEntry,
    showCover,
    includeHeroOnCover,
    showSummary,
    includePreTrip,
    includeComments,
    includeLikes,
    layout,
    oneDayPerPage
  ]);

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
        <button type="button" className="printPrimaryBtn" onClick={openPreview}>
          Preview print layout
        </button>
      </div>
    </div>
  );
};
